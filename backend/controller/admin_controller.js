import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import Bookmark from "../models/Bookmark.js";
import Follow from "../models/Follow.js";
import Notification from "../models/Notification.js";
import Report from "../models/Report.js";
import PostRevision from "../models/PostRevision.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import cloudinary from "../config/cloudinary.js";
import { handle, HttpError } from "../utils/httpError.js";
import { runAtomic } from "../utils/transaction.js";
import { parseDateRange } from "../utils/dateRange.js";
import {
    ROLE_VALUES,
    canManageAccount,
    canModerateContentOf,
    hasPermission,
    isAdminRole
} from "../utils/permissions.js";
import { recordAudit, buildAuditScope, AUDIT_ACTIONS } from "../services/auditService.js";
import {
    removePost,
    restoreRemovedPost,
    deactivateUser,
    normalizeReason,
    sameId,
    authorRoleOf,
    PLACEHOLDER
} from "../services/moderationService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
// Operations inside one transaction session must run one after another; Promise.all over a
// session fails on a replica set with ConflictingOperationInProgress.
const inSequence = async (operations) => {
    for (const run of operations) await run();
};
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pageParams = (query, defaultLimit = 10) => ({
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit))
});

const paginate = (total, page, limit) => ({ total, page, limit, totalPages: Math.ceil(total / limit) });

const requireValidId = (id, label = "ID") => {
    if (!isValidId(id)) throw new HttpError(400, `Invalid ${label}`);
};

// Which actions the acting staff member may perform on a given account. The UI renders from this
// so it never has to re-implement the hierarchy rules.
const accountActionsFor = (actor, target) => {
    const manageable = !sameId(actor._id, target._id) && canManageAccount(actor.role, target.role);
    let roleOptions = [];
    if (actor.role === "superadmin" && !target.isDeleted && !sameId(actor._id, target._id)) {
        if (target.role === "user") roleOptions = ["admin", "moderator"];
        else if (target.role === "admin" || target.role === "moderator") roleOptions = ["user"];
    }
    return {
        canDeactivate: manageable && !target.isDeleted && hasPermission(actor.role, "users:deactivate"),
        canRestore: manageable && target.isDeleted && hasPermission(actor.role, "users:restore"),
        canPurge: manageable && target.isDeleted && hasPermission(actor.role, "users:purge"),
        roleOptions
    };
};

// ---- Dashboard --------------------------------------------------------------------------------

// GET /api/admin/stats?range=7d|30d|90d|custom&from=&to=
export const getAdminStats = handle(async (req, res) => {
    const range = parseDateRange(req.query);
    const inRange = { createdAt: { $gte: range.from, $lte: range.to } };

    const [
        activeUsers,
        deletedUsers,
        admins,
        superadmins,
        moderators,
        publishedPosts,
        draftPosts,
        deletedPosts,
        totalComments,
        totalLikes,
        reportStatusAgg,
        signupsInRange,
        postsInRange,
        recentSignups,
        recentModeration
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isDeleted: true }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ role: "superadmin" }),
        User.countDocuments({ role: "moderator" }),
        Post.countDocuments({ status: "published" }),
        Post.countDocuments({ status: "draft" }),
        Post.countDocuments({ isDeleted: true }),
        Comment.countDocuments({ isDeleted: false }),
        Like.countDocuments(),
        Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        User.countDocuments(inRange).setOptions({ withDeleted: true }),
        Post.countDocuments(inRange).setOptions({ withDeleted: true }),
        User.find()
            .select("username fullName email role createdAt profileImage")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        AdminAuditLog.find(buildAuditScope(req.actor)).sort({ createdAt: -1 }).limit(8).lean()
    ]);

    const reportCounts = Object.fromEntries(reportStatusAgg.map((r) => [r._id, r.count]));
    const reports = {
        total: reportStatusAgg.reduce((sum, r) => sum + r.count, 0),
        pending: reportCounts.pending || 0,
        underReview: reportCounts.under_review || 0,
        resolved: reportCounts.resolved || 0,
        dismissed: reportCounts.dismissed || 0
    };

    return res.json({
        success: true,
        data: {
            range: { key: range.key, from: range.from, to: range.to, days: range.days },
            totals: {
                // all accounts, including deactivated ones
                users: activeUsers + deletedUsers,
                activeUsers,
                deletedUsers,
                admins,
                superadmins,
                moderators,
                publishedPosts,
                draftPosts,
                deletedPosts,
                comments: totalComments,
                likes: totalLikes
            },
            reports,
            // `signupsLast7Days` / `postsLast7Days` keep their historical names for compatibility;
            // they now describe the selected range (7 days by default is no longer assumed).
            recentActivity: {
                signupsInRange,
                postsInRange,
                signupsLast7Days: signupsInRange,
                postsLast7Days: postsInRange
            },
            recentSignups,
            recentModeration
        }
    });
}, "Unable to load admin stats");

// ---- Users ------------------------------------------------------------------------------------

// GET /api/admin/users?search=&role=&status=active|deleted|all&page=&limit=
export const getAdminUsers = handle(async (req, res) => {
    const { page, limit } = pageParams(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    // `status` supersedes the older `deleted=true` flag, which still works.
    let status = ["active", "deleted", "all"].includes(req.query.status) ? req.query.status : null;
    if (!status) status = req.query.deleted === "true" ? "deleted" : "active";

    const filter = {};
    if (status === "deleted") filter.isDeleted = true;
    if (req.query.role !== undefined && req.query.role !== "") {
        if (!ROLE_VALUES.includes(req.query.role)) throw new HttpError(400, "Invalid role filter");
        filter.role = req.query.role;
    }
    if (search) {
        const regex = new RegExp(escapeRegex(search.slice(0, 100)), "i");
        filter.$or = [{ username: regex }, { email: regex }, { fullName: regex }];
    }

    // Filtering on isDeleted explicitly (or withDeleted) bypasses the default "hide deleted" filter
    const withDeleted = status !== "active";
    const baseQuery = () => User.find(filter).setOptions({ withDeleted });

    const [users, total] = await Promise.all([
        baseQuery()
            .select("username fullName email role createdAt profileImage isDeleted deletedAt roleChangedAt lastActiveAt")
            .sort(status === "deleted" ? { deletedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        User.countDocuments(filter).setOptions({ withDeleted })
    ]);

    const userIds = users.map((u) => u._id);
    // A deleted account's posts are soft-deleted with it, so count them too outside the active view
    const postCountQuery = Post.aggregate([
        { $match: { author: { $in: userIds } } },
        { $group: { _id: "$author", count: { $sum: 1 } } }
    ]);
    if (withDeleted) postCountQuery.option({ withDeleted: true });
    const [postCounts, commentCounts] = await Promise.all([
        postCountQuery,
        Comment.aggregate([
            { $match: { author: { $in: userIds }, isDeleted: false } },
            { $group: { _id: "$author", count: { $sum: 1 } } }
        ])
    ]);
    const postCountMap = new Map(postCounts.map((item) => [item._id.toString(), item.count]));
    const commentCountMap = new Map(commentCounts.map((item) => [item._id.toString(), item.count]));

    const enrichedUsers = users.map((u) => ({
        ...u,
        postsCount: postCountMap.get(u._id.toString()) || 0,
        commentsCount: commentCountMap.get(u._id.toString()) || 0
    }));

    return res.json({
        success: true,
        data: { users: enrichedUsers, pagination: paginate(total, page, limit) }
    });
}, "Unable to load users");

// GET /api/admin/users/:id
export const getAdminUserById = handle(async (req, res) => {
    const { id } = req.params;
    const query = isValidId(id) ? { _id: id } : { username: String(id).toLowerCase() };
    // withDeleted: admins can open a soft-deleted account to restore or purge it
    const user = await User.findOne(query)
        .setOptions({ withDeleted: true })
        .select("-password -refreshToken")
        .populate({ path: "roleChangedBy", select: "username", options: { withDeleted: true } })
        .lean();
    if (!user) throw new HttpError(404, "User not found");

    const userId = user._id;
    // A deleted account's posts are soft-deleted with it, so count them too in that case
    const postOptions = user.isDeleted ? { withDeleted: true } : {};
    const [
        postsCount,
        publishedPosts,
        draftPosts,
        commentsCount,
        followersCount,
        followingCount,
        likesGiven,
        reportsAgainstAgg,
        reportsFiled
    ] = await Promise.all([
        Post.countDocuments({ author: userId }).setOptions(postOptions),
        Post.countDocuments({ author: userId, status: "published" }).setOptions(postOptions),
        Post.countDocuments({ author: userId, status: "draft" }).setOptions(postOptions),
        Comment.countDocuments({ author: userId, isDeleted: false }),
        Follow.countDocuments({ following: userId }),
        Follow.countDocuments({ follower: userId }),
        Like.countDocuments({ user: userId }),
        Report.aggregate([
            { $match: { $or: [{ targetType: "user", targetId: userId }, { targetOwner: userId }] } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),
        Report.countDocuments({ reporter: userId })
    ]);

    const against = Object.fromEntries(reportsAgainstAgg.map((r) => [r._id, r.count]));
    const openReports = (against.pending || 0) + (against.under_review || 0);

    return res.json({
        success: true,
        data: {
            user,
            counts: {
                posts: postsCount,
                comments: commentsCount,
                followers: followersCount,
                following: followingCount
            },
            activity: { publishedPosts, draftPosts, likesGiven, lastActiveAt: user.lastActiveAt || null },
            reports: {
                againstTotal: reportsAgainstAgg.reduce((sum, r) => sum + r.count, 0),
                againstOpen: openReports,
                filed: reportsFiled
            },
            actions: accountActionsFor(req.actor, user)
        }
    });
}, "Unable to load user details");

// GET /api/admin/users/:id/posts?status=&page=
export const getAdminUserPosts = handle(async (req, res) => {
    const { id } = req.params;
    const queryUser = isValidId(id) ? { _id: id } : { username: String(id).toLowerCase() };
    const user = await User.findOne(queryUser).setOptions({ withDeleted: true }).select("_id isDeleted");
    if (!user) throw new HttpError(404, "User not found");

    const { page, limit } = pageParams(req.query);
    const status = req.query.status;

    const postFilter = { author: user._id };
    if (status && ["draft", "published"].includes(status)) {
        postFilter.status = status;
    }

    // For a soft-deleted account, show its (also soft-deleted) posts instead of an empty list
    const postOptions = user.isDeleted ? { withDeleted: true } : {};

    const [posts, total] = await Promise.all([
        Post.find(postFilter)
            .setOptions(postOptions)
            .populate("category", "name slug")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Post.countDocuments(postFilter).setOptions(postOptions)
    ]);

    const enrichedPosts = await withEngagementCounts(posts);
    return res.json({ success: true, data: { posts: enrichedPosts, pagination: paginate(total, page, limit) } });
}, "Unable to load user posts");

// ---- Posts ------------------------------------------------------------------------------------

const withEngagementCounts = async (posts) => {
    const postIds = posts.map((p) => p._id);
    const [commentAgg, likeAgg] = await Promise.all([
        Comment.aggregate([
            { $match: { post: { $in: postIds }, isDeleted: false } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]),
        Like.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ])
    ]);
    const commentMap = new Map(commentAgg.map((c) => [c._id.toString(), c.count]));
    const likeMap = new Map(likeAgg.map((l) => [l._id.toString(), l.count]));

    return posts.map((p) => ({
        ...p,
        views: p.views || 0,
        likesCount: likeMap.get(p._id.toString()) || 0,
        commentsCount: commentMap.get(p._id.toString()) || 0
    }));
};

// GET /api/admin/posts?search=&status=&featured=&author=&category=&deleted=&page=
export const getAdminPosts = handle(async (req, res) => {
    const { page, limit } = pageParams(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = req.query.status;

    // ?deleted=true lists soft-deleted posts; otherwise only live ones.
    // Filtering on isDeleted explicitly bypasses the default "hide deleted" filter.
    const showDeleted = req.query.deleted === "true";

    const filter = showDeleted ? { isDeleted: true } : {};
    if (status && ["draft", "published"].includes(status)) filter.status = status;
    if (req.query.featured === "true") filter.isFeatured = true;
    if (req.query.featured === "false") filter.isFeatured = { $ne: true };
    if (req.query.category) {
        if (!isValidId(req.query.category)) throw new HttpError(400, "Invalid category");
        filter.category = req.query.category;
    }
    if (req.query.author) {
        const key = String(req.query.author);
        const author = await User.findOne(isValidId(key) ? { _id: key } : { username: key.toLowerCase() })
            .setOptions({ withDeleted: true })
            .select("_id");
        // An unknown author is an empty result, not an error
        filter.author = author ? author._id : new mongoose.Types.ObjectId();
    }
    if (search) {
        const regex = new RegExp(escapeRegex(search.slice(0, 100)), "i");
        filter.$or = [{ title: regex }, { excerpt: regex }, { tags: regex }];
    }

    // Moderators investigate content, they do not need contact details
    const authorFields = isAdminRole(req.actor.role)
        ? "username fullName profileImage email isDeleted role"
        : "username fullName profileImage isDeleted role";

    const [posts, total] = await Promise.all([
        Post.find(filter)
            // withDeleted on the populate so a post whose author was also soft-deleted
            // still shows that author instead of "[deleted author]"
            .populate({ path: "author", select: authorFields, options: { withDeleted: true } })
            .populate("category", "name slug")
            .populate({ path: "deletedBy", select: "username role", options: { withDeleted: true } })
            .sort(showDeleted ? { deletedAt: -1, _id: -1 } : { createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Post.countDocuments(filter)
    ]);

    const enrichedPosts = await withEngagementCounts(posts);
    return res.json({ success: true, data: { posts: enrichedPosts, pagination: paginate(total, page, limit) } });
}, "Unable to load posts");

// DELETE /api/admin/posts/:id — soft delete: hide the post but keep everything so it can be restored
export const deleteAdminPost = handle(async (req, res) => {
    requireValidId(req.params.id, "post ID");
    await removePost(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({ success: true, message: "Post moved to deleted posts" });
}, "Failed to delete post");

// PATCH /api/admin/posts/:id/restore
export const restoreAdminPost = handle(async (req, res) => {
    requireValidId(req.params.id, "post ID");
    await restoreRemovedPost(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({ success: true, message: "Post restored" });
}, "Failed to restore post");

// Cloudinary deletes are irreversible, so they only run after the database changes succeeded.
const destroyAssets = async (publicIds) => {
    const failed = [];
    for (const publicId of publicIds.filter(Boolean)) {
        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        } catch (error) {
            failed.push(publicId);
            console.error(`Cloudinary destroy failed for ${publicId}:`, error);
        }
    }
    return failed;
};

// DELETE /api/admin/posts/:id/permanent — remove a post that is already soft-deleted, for good
export const permanentlyDeleteAdminPost = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "post ID");

    const post = await Post.findOne({ _id: id, isDeleted: true });
    if (!post) {
        throw new HttpError(404, "Deleted post not found. Move it to deleted posts first.");
    }
    if (!sameId(post.author, req.actor._id) && !canModerateContentOf(req.actor.role, await authorRoleOf(post.author))) {
        throw new HttpError(403, "You cannot permanently delete content written by this account");
    }
    const reason = normalizeReason(req.body?.reason);

    await runAtomic(async (session) => {
        await inSequence([
            () => Like.deleteMany({ post: id }, { session }),
            () => Bookmark.deleteMany({ post: id }, { session }),
            () => Comment.deleteMany({ post: id }, { session }),
            () => Notification.deleteMany({ post: id }, { session }),
            () => PostRevision.deleteMany({ post: id }, { session })
        ]);
        // deleteOne is not filtered, so it removes the soft-deleted document
        await Post.deleteOne({ _id: id }, { session });
        await recordAudit(
            req.actor,
            {
                action: AUDIT_ACTIONS.POST_PURGE,
                targetType: "post",
                targetId: post._id,
                targetLabel: post.title,
                reason,
                metadata: { authorId: post.author, hadCoverImage: Boolean(post.coverImagePublicId) }
            },
            { session }
        );
    });

    const failed = await destroyAssets([post.coverImagePublicId]);
    return res.json({
        success: true,
        message: "Post permanently deleted",
        ...(failed.length ? { warnings: [`${failed.length} image(s) could not be removed from cloud storage`] } : {})
    });
}, "Failed to delete post");

// ---- Account actions --------------------------------------------------------------------------

// DELETE /api/admin/users/:id — soft delete: deactivate the account and hide its posts
export const deleteAdminUser = handle(async (req, res) => {
    requireValidId(req.params.id, "user ID");
    const { user, hiddenPosts } = await deactivateUser(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({
        success: true,
        message: `User @${user.username} deleted. ${hiddenPosts} post(s) were hidden.`
    });
}, "Failed to delete user");

// PATCH /api/admin/users/:id/restore
export const restoreAdminUser = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "user ID");

    const targetUser = await User.findOne({ _id: id, isDeleted: true });
    if (!targetUser) throw new HttpError(404, "Deleted user not found");
    if (!canManageAccount(req.actor.role, targetUser.role)) {
        throw new HttpError(403, `You cannot restore ${targetUser.role} accounts`);
    }
    const reason = normalizeReason(req.body?.reason);
    const deletedAt = targetUser.deletedAt;

    const restoredPosts = await runAtomic(async (session) => {
        await User.updateOne({ _id: id }, { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }, { session });

        // Bring back only the posts that were hidden together with the account (same deletedAt)
        let count = 0;
        if (deletedAt) {
            const result = await Post.updateMany(
                { author: id, isDeleted: true, deletedAt },
                { $set: { isDeleted: false, deletedAt: null, deletedBy: null } },
                { session }
            );
            count = result.modifiedCount || 0;
        }
        await recordAudit(
            req.actor,
            {
                action: AUDIT_ACTIONS.USER_RESTORE,
                targetType: "user",
                targetId: targetUser._id,
                targetLabel: `@${targetUser.username}`,
                reason,
                metadata: { targetRole: targetUser.role, postsRestored: count }
            },
            { session }
        );
        return count;
    });

    return res.json({
        success: true,
        message: `User @${targetUser.username} restored. ${restoredPosts} post(s) are visible again.`
    });
}, "Failed to restore user");

// Deletes every trace of a user from the database. Returns the cloud assets to delete afterwards.
// Order matters for the non-transactional fallback: the user document goes last, so a failure part
// way leaves the account in the "deleted" list where the purge can simply be run again (every step
// below is idempotent).
const purgeUserData = async (target, session) => {
    const id = target._id;

    const userPosts = await Post.find({ author: id })
        .setOptions({ withDeleted: true })
        .select("_id coverImagePublicId")
        .session(session);
    const postIds = userPosts.map((p) => p._id);
    const assets = userPosts.map((p) => p.coverImagePublicId);

    if (postIds.length > 0) {
        await inSequence([
            () => Like.deleteMany({ post: { $in: postIds } }, { session }),
            () => Bookmark.deleteMany({ post: { $in: postIds } }, { session }),
            () => Comment.deleteMany({ post: { $in: postIds } }, { session }),
            () => Notification.deleteMany({ post: { $in: postIds } }, { session }),
            () => PostRevision.deleteMany({ post: { $in: postIds } }, { session })
        ]);
    }
    await Post.deleteMany({ author: id }, { session });

    await inSequence([
        () => Like.deleteMany({ user: id }, { session }),
        () => Bookmark.deleteMany({ user: id }, { session }),
        () => Follow.deleteMany({ $or: [{ follower: id }, { following: id }] }, { session }),
        () => Comment.updateMany({ likes: id }, { $pull: { likes: id } }, { session })
    ]);

    // The user's remaining comments (on other people's posts): keep a "[deleted]" placeholder where
    // other people replied, so threads stay intact; delete the rest. A comment also stays if it is
    // the parent of a kept placeholder, so no reply is ever orphaned.
    const authored = await Comment.find({ author: id }).select("_id parentComment").session(session).lean();
    if (authored.length > 0) {
        const authoredIds = authored.map((c) => c._id);
        const parentOf = new Map(authored.map((c) => [c._id.toString(), c.parentComment?.toString() || null]));
        const keep = new Set(
            (
                await Comment.distinct("parentComment", {
                    parentComment: { $in: authoredIds },
                    author: { $ne: id }
                }).session(session)
            ).map(String)
        );
        let changed = true;
        while (changed) {
            changed = false;
            for (const keptId of [...keep]) {
                const parent = parentOf.get(keptId);
                if (parent && parentOf.has(parent) && !keep.has(parent)) {
                    keep.add(parent);
                    changed = true;
                }
            }
        }
        const keepIds = [...keep].map((k) => new mongoose.Types.ObjectId(k));
        if (keepIds.length > 0) {
            await Comment.updateMany(
                { _id: { $in: keepIds } },
                { $set: { isDeleted: true, content: PLACEHOLDER, likes: [], deletedAt: new Date(), deletedBy: null } },
                { session }
            );
        }
        await Comment.deleteMany({ author: id, _id: { $nin: keepIds } }, { session });
    }

    await Notification.deleteMany({ $or: [{ sender: id }, { recipient: id }] }, { session });

    assets.push(target.profileImagePublicId, target.coverImagePublicId);
    // deleteOne is not filtered, unlike findByIdAndDelete
    await User.deleteOne({ _id: id }, { session });
    return { assets, postsDeleted: postIds.length };
};

// DELETE /api/admin/users/:id/permanent — remove an already soft-deleted user and all their data, for good
export const permanentlyDeleteAdminUser = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "user ID");

    if (sameId(id, req.actor._id)) {
        throw new HttpError(400, "You cannot delete your own account");
    }
    const targetUser = await User.findOne({ _id: id, isDeleted: true });
    if (!targetUser) {
        throw new HttpError(404, "Deleted user not found. Delete the account first.");
    }
    if (!hasPermission(req.actor.role, "users:purge") || !canManageAccount(req.actor.role, targetUser.role)) {
        throw new HttpError(
            403,
            targetUser.role === "superadmin"
                ? "Super Admin accounts are protected and cannot be deleted"
                : `You cannot permanently delete ${targetUser.role} accounts`
        );
    }
    const reason = normalizeReason(req.body?.reason);

    let outcome;
    try {
        outcome = await runAtomic(async (session) => {
            const result = await purgeUserData(targetUser, session);
            await recordAudit(
                req.actor,
                {
                    action: AUDIT_ACTIONS.USER_PURGE,
                    targetType: "user",
                    targetId: targetUser._id,
                    targetLabel: `@${targetUser.username}`,
                    reason,
                    metadata: { targetRole: targetUser.role, postsDeleted: result.postsDeleted }
                },
                { session }
            );
            return result;
        });
    } catch (error) {
        console.error("permanentlyDeleteAdminUser failed:", error);
        // Failure tracking for the retryable (non-transactional) path
        await recordAudit(req.actor, {
            action: AUDIT_ACTIONS.USER_PURGE_FAILED,
            targetType: "user",
            targetId: targetUser._id,
            targetLabel: `@${targetUser.username}`,
            reason,
            metadata: { error: error.message }
        });
        throw new HttpError(500, "The account could not be fully deleted. It is still listed as deleted; try again.");
    }

    const failed = await destroyAssets(outcome.assets);
    return res.json({
        success: true,
        message: `User @${targetUser.username} and all associated data permanently deleted`,
        ...(failed.length ? { warnings: [`${failed.length} image(s) could not be removed from cloud storage`] } : {})
    });
}, "Failed to delete user");

export { accountActionsFor };
