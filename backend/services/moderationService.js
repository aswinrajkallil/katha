import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import { emitToAll, emitToRoom } from "../socket.js";
import { recordAudit, AUDIT_ACTIONS } from "./auditService.js";
import { runAtomic } from "../utils/transaction.js";
import { HttpError } from "../utils/httpError.js";
import { canManageAccount, canModerateContentOf, hasPermission, isAdminRole } from "../utils/permissions.js";

const PLACEHOLDER = "[deleted]";

const sameId = (a, b) => Boolean(a && b && a.toString() === b.toString());

/** Trim a moderation reason; optionally insist on a meaningful one. */
export const normalizeReason = (value, { required = false, min = 3 } = {}) => {
    const reason = typeof value === "string" ? value.trim().slice(0, 1000) : "";
    if (required && reason.length < min) {
        throw new HttpError(400, `A reason of at least ${min} characters is required`);
    }
    return reason;
};

// Moderators must always justify removals; admins may omit it but it is recorded when given.
const reasonFor = (actor, value) => normalizeReason(value, { required: actor.role === "moderator" });

const authorRoleOf = async (authorId) => {
    const author = await User.findById(authorId).setOptions({ withDeleted: true }).select("role username");
    return author ? author.role : "user";
};

const activeCommentCount = (postId) => Comment.countDocuments({ post: postId, isDeleted: false });

// ---- Posts ------------------------------------------------------------------------------------

export const removePost = async (actor, postId, { reason: rawReason } = {}) => {
    const post = await Post.findById(postId);
    if (!post) throw new HttpError(404, "Post not found");

    const isOwn = sameId(post.author, actor._id);
    if (!isOwn && !canModerateContentOf(actor.role, await authorRoleOf(post.author))) {
        throw new HttpError(403, "You cannot remove content written by this account");
    }
    const reason = reasonFor(actor, rawReason);
    const now = new Date();

    await runAtomic(async (session) => {
        await Post.updateOne(
            { _id: post._id },
            { $set: { isDeleted: true, deletedAt: now, deletedBy: actor._id, moderationReason: reason || null } },
            { session }
        );
        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.POST_REMOVE,
                targetType: "post",
                targetId: post._id,
                targetLabel: post.title,
                reason,
                metadata: { authorId: post.author, wasPublished: post.status === "published" }
            },
            { session }
        );
    });

    emitToAll("post:deleted", { postId: post._id.toString() });
    emitToRoom(`post:${post._id}`, "post:deleted", { postId: post._id.toString() });
    return post;
};

export const restoreRemovedPost = async (actor, postId, { reason: rawReason } = {}) => {
    const post = await Post.findOne({ _id: postId, isDeleted: true });
    if (!post) throw new HttpError(404, "Deleted post not found");

    // A moderator may only undo their own removals; admins may undo anyone's.
    if (actor.role === "moderator" && !sameId(post.deletedBy, actor._id)) {
        throw new HttpError(403, "Moderators can only restore content they removed themselves");
    }
    if (!sameId(post.author, actor._id) && !canModerateContentOf(actor.role, await authorRoleOf(post.author))) {
        throw new HttpError(403, "You cannot restore content written by this account");
    }
    // The post would reappear with no author while the author's account is deactivated
    if (await User.exists({ _id: post.author, isDeleted: true })) {
        throw new HttpError(409, "The author's account is deleted. Restore the account first.");
    }
    const reason = normalizeReason(rawReason);

    await runAtomic(async (session) => {
        await Post.updateOne(
            { _id: post._id },
            { $set: { isDeleted: false, deletedAt: null, deletedBy: null, moderationReason: null } },
            { session }
        );
        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.POST_RESTORE,
                targetType: "post",
                targetId: post._id,
                targetLabel: post.title,
                reason,
                metadata: { previouslyRemovedBy: post.deletedBy, previousReason: post.moderationReason }
            },
            { session }
        );
    });
    return post;
};

// ---- Comments ---------------------------------------------------------------------------------

export const removeComment = async (actor, commentId, { reason: rawReason } = {}) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new HttpError(404, "Comment not found");
    if (comment.isDeleted) throw new HttpError(409, "This comment is already removed");

    const isOwn = sameId(comment.author, actor._id);
    if (!isOwn && !canModerateContentOf(actor.role, await authorRoleOf(comment.author))) {
        throw new HttpError(403, "You cannot remove content written by this account");
    }
    const reason = reasonFor(actor, rawReason);
    const now = new Date();

    await runAtomic(async (session) => {
        // The `isDeleted: false` guard makes a concurrent double-removal fail cleanly.
        const result = await Comment.updateOne(
            { _id: comment._id, isDeleted: false },
            { $set: { isDeleted: true, deletedAt: now, deletedBy: actor._id, moderationReason: reason || null } },
            { session }
        );
        if (result.matchedCount === 0) throw new HttpError(409, "This comment is already removed");

        // Notifications pointing at the removed comment would link to nothing useful
        await Notification.deleteMany({ comment: comment._id }, { session });

        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.COMMENT_REMOVE,
                targetType: "comment",
                targetId: comment._id,
                targetLabel: comment.content.slice(0, 120),
                reason,
                metadata: { postId: comment.post, authorId: comment.author }
            },
            { session }
        );
    });

    const postId = comment.post.toString();
    emitToRoom(`post:${postId}`, "comment:deleted", {
        postId,
        commentsCount: await activeCommentCount(postId),
        commentId: comment._id.toString(),
        softDeleted: true,
        moderated: true,
        actorId: actor._id.toString()
    });
    return comment;
};

export const restoreRemovedComment = async (actor, commentId, { reason: rawReason } = {}) => {
    const comment = await Comment.findOne({ _id: commentId, isDeleted: true });
    if (!comment) throw new HttpError(404, "Deleted comment not found");

    // Author-deleted comments (and legacy rows without metadata) had their text overwritten.
    if (!comment.deletedBy || sameId(comment.deletedBy, comment.author)) {
        throw new HttpError(409, "This comment was deleted by its author and cannot be restored");
    }
    if (comment.content === PLACEHOLDER) {
        throw new HttpError(409, "This comment was permanently removed and cannot be restored");
    }
    if (actor.role === "moderator" && !sameId(comment.deletedBy, actor._id)) {
        throw new HttpError(403, "Moderators can only restore content they removed themselves");
    }
    if (!sameId(comment.author, actor._id) && !canModerateContentOf(actor.role, await authorRoleOf(comment.author))) {
        throw new HttpError(403, "You cannot restore content written by this account");
    }
    if (!(await Post.exists({ _id: comment.post }))) {
        throw new HttpError(409, "The parent post is deleted. Restore the post first.");
    }
    if (await User.exists({ _id: comment.author, isDeleted: true })) {
        throw new HttpError(409, "The author's account is deleted. Restore the account first.");
    }
    const reason = normalizeReason(rawReason);

    await runAtomic(async (session) => {
        await Comment.updateOne(
            { _id: comment._id },
            { $set: { isDeleted: false, deletedAt: null, deletedBy: null, moderationReason: null } },
            { session }
        );
        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.COMMENT_RESTORE,
                targetType: "comment",
                targetId: comment._id,
                targetLabel: comment.content.slice(0, 120),
                reason,
                metadata: { postId: comment.post, previousReason: comment.moderationReason }
            },
            { session }
        );
    });

    const postId = comment.post.toString();
    emitToRoom(`post:${postId}`, "comment:updated", {
        postId,
        commentsCount: await activeCommentCount(postId),
        comment: { _id: comment._id.toString(), isDeleted: false },
        actorId: actor._id.toString()
    });
    return comment;
};

/**
 * Permanently remove an already-removed comment without breaking its thread:
 *  - with replies -> the row stays as a "[deleted]" placeholder (text and likes wiped)
 *  - without replies -> the row is deleted, and any now-childless placeholder ancestors go with it
 */
export const purgeComment = async (actor, commentId, { reason: rawReason } = {}) => {
    if (!isAdminRole(actor.role)) throw new HttpError(403, "Admin access required");
    const comment = await Comment.findOne({ _id: commentId, isDeleted: true });
    if (!comment) {
        throw new HttpError(404, "Deleted comment not found. Remove the comment first.");
    }
    const reason = normalizeReason(rawReason);

    const result = await runAtomic(async (session) => {
        const hasReplies = await Comment.exists({ parentComment: comment._id }).session(session);
        let mode = "tombstoned";
        let prunedAncestors = 0;
        const notificationIds = [comment._id];

        if (hasReplies) {
            await Comment.updateOne(
                { _id: comment._id },
                { $set: { content: PLACEHOLDER, likes: [] } },
                { session }
            );
        } else {
            mode = "deleted";
            await Comment.deleteOne({ _id: comment._id }, { session });

            let parentId = comment.parentComment;
            while (parentId && prunedAncestors < 50) {
                const parent = await Comment.findById(parentId).session(session);
                if (!parent || !parent.isDeleted || parent.content !== PLACEHOLDER) break;
                if (await Comment.exists({ parentComment: parent._id }).session(session)) break;
                await Comment.deleteOne({ _id: parent._id }, { session });
                notificationIds.push(parent._id);
                prunedAncestors += 1;
                parentId = parent.parentComment;
            }
        }

        await Notification.deleteMany({ comment: { $in: notificationIds } }, { session });
        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.COMMENT_PURGE,
                targetType: "comment",
                targetId: comment._id,
                targetLabel: comment.content.slice(0, 120),
                reason,
                metadata: { postId: comment.post, mode, prunedAncestors }
            },
            { session }
        );
        return { mode, prunedAncestors };
    });

    const postId = comment.post.toString();
    emitToRoom(`post:${postId}`, "comment:deleted", {
        postId,
        commentsCount: await activeCommentCount(postId),
        commentId: comment._id.toString(),
        softDeleted: result.mode === "tombstoned",
        moderated: true,
        actorId: actor._id.toString()
    });
    return { comment, ...result };
};

// ---- Accounts ---------------------------------------------------------------------------------

export const deactivateUser = async (actor, userId, { reason: rawReason } = {}) => {
    if (!hasPermission(actor.role, "users:deactivate")) {
        throw new HttpError(403, "You do not have permission to deactivate accounts");
    }
    if (sameId(actor._id, userId)) {
        throw new HttpError(400, "You cannot deactivate your own account");
    }

    // Already-deactivated users are hidden from findById, so they surface as 404
    const target = await User.findById(userId);
    if (!target) throw new HttpError(404, "User not found");

    if (!canManageAccount(actor.role, target.role)) {
        throw new HttpError(
            403,
            target.role === "superadmin"
                ? "Super Admin accounts are protected and cannot be deactivated"
                : `You cannot deactivate ${target.role} accounts`
        );
    }
    const reason = normalizeReason(rawReason);
    const now = new Date();

    // Only posts that are live right now get hidden. Posts the author deleted earlier keep their
    // own deletedAt, so restoring the account never brings those back.
    const livePosts = await Post.find({ author: target._id }).select("_id").lean();
    const livePostIds = livePosts.map((p) => p._id);

    await runAtomic(async (session) => {
        await User.updateOne(
            { _id: target._id },
            // refreshToken cleared so existing sessions cannot be refreshed
            { $set: { isDeleted: true, deletedAt: now, deletedBy: actor._id, refreshToken: null } },
            { session }
        );
        await Post.updateMany(
            { _id: { $in: livePostIds } },
            { $set: { isDeleted: true, deletedAt: now, deletedBy: actor._id } },
            { session }
        );
        await recordAudit(
            actor,
            {
                action: AUDIT_ACTIONS.USER_DEACTIVATE,
                targetType: "user",
                targetId: target._id,
                targetLabel: `@${target.username}`,
                reason,
                metadata: { targetRole: target.role, postsHidden: livePostIds.length }
            },
            { session }
        );
    });

    for (const postId of livePostIds) emitToAll("post:deleted", { postId: postId.toString() });
    return { user: target, hiddenPosts: livePostIds.length };
};

export { sameId, authorRoleOf, activeCommentCount, PLACEHOLDER };
