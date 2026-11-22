import mongoose from "mongoose";
import Post from "../models/Post.js";
import Category from "../models/Category.js";
import PostRevision from "../models/PostRevision.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import Follow from "../models/Follow.js";
import { emitToAll, emitToRoom } from "../socket.js";
import { handle, HttpError } from "../utils/httpError.js";
import { runAtomic } from "../utils/transaction.js";
import { canModerateContentOf, isAdminRole } from "../utils/permissions.js";
import { recordAudit, buildTargetHistoryScope, AUDIT_ACTIONS } from "../services/auditService.js";
import { normalizeReason, sameId, authorRoleOf } from "../services/moderationService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const requireValidId = (id, label = "ID") => {
    if (!isValidId(id)) throw new HttpError(400, `Invalid ${label}`);
};

const assertMayModerate = async (actor, post) => {
    if (sameId(post.author, actor._id)) return;
    if (!canModerateContentOf(actor.role, await authorRoleOf(post.author))) {
        throw new HttpError(403, "You cannot modify content written by this account");
    }
};

// ---- Edit -------------------------------------------------------------------------------------

const MAX_TITLE = 200;
const MAX_CONTENT = 100000;
const MAX_EXCERPT = 500;
const MAX_TAGS = 20;
const MAX_TAG = 40;

const cleanTags = (value) => {
    if (!Array.isArray(value)) throw new HttpError(400, "tags must be a list");
    const tags = [...new Set(value.map((tag) => (typeof tag === "string" ? tag.trim() : null)))];
    if (tags.some((tag) => !tag || tag.length > MAX_TAG) || tags.length > MAX_TAGS) {
        throw new HttpError(400, `tags must be up to ${MAX_TAGS} non-empty items of at most ${MAX_TAG} characters`);
    }
    return tags;
};

// PATCH /api/admin/posts/:id — edit title/content/excerpt/tags/category.
// Allowlist only: author, status, slug, counters etc. can never be changed here. The previous
// values are saved as a PostRevision and the edit is written to the audit log.
export const editAdminPost = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "post ID");

    const post = await Post.findById(id);
    if (!post) throw new HttpError(404, "Post not found");
    await assertMayModerate(req.actor, post);

    const reason = normalizeReason(req.body?.reason, { required: true });
    const body = req.body || {};
    const next = {};

    if (body.title !== undefined) {
        if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > MAX_TITLE) {
            throw new HttpError(400, `Title must be between 1 and ${MAX_TITLE} characters`);
        }
        next.title = body.title.trim();
    }
    if (body.content !== undefined) {
        if (body.content !== null && (typeof body.content !== "string" || body.content.length > MAX_CONTENT)) {
            throw new HttpError(400, `Content must be text of at most ${MAX_CONTENT} characters`);
        }
        next.content = body.content;
    }
    if (body.excerpt !== undefined) {
        if (body.excerpt !== null && (typeof body.excerpt !== "string" || body.excerpt.length > MAX_EXCERPT)) {
            throw new HttpError(400, `Excerpt must be text of at most ${MAX_EXCERPT} characters`);
        }
        next.excerpt = body.excerpt;
    }
    if (body.tags !== undefined) next.tags = cleanTags(body.tags);
    if (body.category !== undefined) {
        if (body.category === null || body.category === "") {
            next.category = null;
        } else {
            if (!isValidId(body.category) || !(await Category.exists({ _id: body.category }))) {
                throw new HttpError(400, "Category not found");
            }
            next.category = body.category;
        }
    }

    const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    // Plain-object snapshot so the revision never holds live Mongoose arrays/ObjectIds
    const snapshot = post.toObject();
    const before = {};
    const changedFields = [];
    for (const [field, value] of Object.entries(next)) {
        const current = field === "category" ? snapshot.category?.toString() || null : snapshot[field];
        const incoming = field === "category" && value ? value.toString() : value;
        if (!sameValue(current, incoming)) {
            changedFields.push(field);
            before[field] = field === "category" ? snapshot.category?.toString() || null : snapshot[field];
        }
    }
    if (changedFields.length === 0) throw new HttpError(400, "No changes to save");

    const set = { lastAdminEditAt: new Date(), lastAdminEditBy: req.actor._id };
    for (const field of changedFields) set[field] = next[field];
    // updateOne (not save): editing the title must not silently change the post's public URL slug.

    const after = {};
    for (const field of changedFields) after[field] = next[field];
    const metadata = { changedFields, authorId: post.author, before, after };
    if (changedFields.includes("content")) {
        // Long text is truncated by the audit sanitizer; the full original is kept in the PostRevision.
        metadata.contentLength = { before: snapshot.content?.length || 0, after: next.content?.length || 0 };
    }

    await runAtomic(async (session) => {
        await PostRevision.create(
            [
                {
                    post: post._id,
                    editedBy: req.actor._id,
                    editedByUsername: req.actor.username,
                    editedByRole: req.actor.role,
                    reason,
                    changedFields,
                    before
                }
            ],
            { session }
        );
        await Post.updateOne({ _id: post._id }, { $set: set }, { session });
        await recordAudit(
            req.actor,
            {
                action: AUDIT_ACTIONS.POST_EDIT,
                targetType: "post",
                targetId: post._id,
                targetLabel: post.title,
                reason,
                metadata
            },
            { session }
        );
    });

    const updated = await Post.findById(id)
        .populate({ path: "author", select: "username fullName profileImage", options: { withDeleted: true } })
        .populate("category", "name slug")
        .lean();
    return res.json({ success: true, message: "Post updated", data: updated });
}, "Failed to update post");

// ---- Publish / unpublish ----------------------------------------------------------------------

// PATCH /api/admin/posts/:id/status { status: "published" | "draft", reason }
export const setAdminPostStatus = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "post ID");
    const status = req.body?.status;
    if (!["published", "draft"].includes(status)) {
        throw new HttpError(400, "status must be published or draft");
    }

    const post = await Post.findById(id);
    if (!post) throw new HttpError(404, "Post not found");
    await assertMayModerate(req.actor, post);
    if (post.status === status) {
        throw new HttpError(409, status === "published" ? "The post is already published" : "The post is already a draft");
    }

    const unpublishing = status === "draft";
    const reason = normalizeReason(req.body?.reason, { required: unpublishing });

    await runAtomic(async (session) => {
        const result = await Post.updateOne(
            { _id: post._id, status: post.status },
            {
                $set: {
                    status,
                    // Unpublishing is moderation: hold it so the author cannot just re-publish.
                    moderationHold: unpublishing,
                    moderationReason: unpublishing ? reason : null,
                    lastAdminEditAt: new Date(),
                    lastAdminEditBy: req.actor._id
                }
            },
            { session }
        );
        if (result.matchedCount === 0) throw new HttpError(409, "The post changed while you were editing; refresh and retry");
        await recordAudit(
            req.actor,
            {
                action: unpublishing ? AUDIT_ACTIONS.POST_UNPUBLISH : AUDIT_ACTIONS.POST_PUBLISH,
                targetType: "post",
                targetId: post._id,
                targetLabel: post.title,
                reason,
                metadata: { authorId: post.author, from: post.status, to: status }
            },
            { session }
        );
    });

    if (unpublishing) {
        // Open feeds drop it straight away
        emitToAll("post:deleted", { postId: id });
        emitToRoom(`post:${id}`, "post:deleted", { postId: id });
    } else {
        const fresh = await Post.findById(id).populate("author", "username profileImage").lean();
        const payload = {
            _id: fresh._id,
            title: fresh.title,
            excerpt: fresh.excerpt,
            type: fresh.type,
            coverImage: fresh.coverImage,
            createdAt: fresh.createdAt,
            author: fresh.author
        };
        emitToAll("post:created", { post: payload, authorId: String(post.author) });
        // Also reach followers who joined their personal room after the broadcast
        Follow.find({ following: post.author })
            .select("follower")
            .lean()
            .then((followers) =>
                followers.forEach((f) =>
                    emitToRoom(`user:${f.follower}`, "post:created", { post: payload, authorId: String(post.author) })
                )
            )
            .catch(() => {});
    }

    return res.json({ success: true, message: unpublishing ? "Post unpublished" : "Post published" });
}, "Failed to change post status");

// ---- History ----------------------------------------------------------------------------------

// GET /api/admin/posts/:id/history
export const getAdminPostHistory = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "post ID");
    const post = await Post.findOne({ _id: id }).setOptions({ withDeleted: true }).select("title author");
    if (!post) throw new HttpError(404, "Post not found");

    const history = await AdminAuditLog.find({
        targetType: "post",
        targetId: post._id,
        ...buildTargetHistoryScope(req.actor)
    })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    // Original text of edited posts is admin-level information
    const revisions = isAdminRole(req.actor.role)
        ? await PostRevision.find({ post: post._id }).sort({ createdAt: -1 }).limit(50).lean()
        : [];

    return res.json({ success: true, data: { post: { _id: post._id, title: post.title }, history, revisions } });
}, "Unable to load post history");

// ---- Featured posts ---------------------------------------------------------------------------

// PATCH /api/admin/posts/:id/feature { featured: boolean }
export const setPostFeatured = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "post ID");
    if (typeof req.body?.featured !== "boolean") throw new HttpError(400, "featured must be true or false");
    const featured = req.body.featured;
    const reason = normalizeReason(req.body?.reason);

    const post = await Post.findById(id).select("title status isFeatured featuredOrder");
    if (!post) throw new HttpError(404, "Post not found");

    if (featured) {
        if (post.status !== "published") throw new HttpError(409, "Only published posts can be featured");
        if (post.isFeatured) throw new HttpError(409, "This post is already featured");

        const last = await Post.findOne({ isFeatured: true }).sort({ featuredOrder: -1 }).select("featuredOrder").lean();
        const order = (last?.featuredOrder || 0) + 1;

        await runAtomic(async (session) => {
            // The filter makes featuring idempotent: a concurrent request cannot create a duplicate entry.
            const result = await Post.updateOne(
                { _id: post._id, status: "published", isFeatured: { $ne: true } },
                { $set: { isFeatured: true, featuredAt: new Date(), featuredBy: req.actor._id, featuredOrder: order } },
                { session }
            );
            if (result.matchedCount === 0) throw new HttpError(409, "This post is already featured");
            await recordAudit(
                req.actor,
                { action: AUDIT_ACTIONS.POST_FEATURE, targetType: "post", targetId: post._id, targetLabel: post.title, reason, metadata: { order } },
                { session }
            );
        });
    } else {
        if (!post.isFeatured) throw new HttpError(409, "This post is not featured");
        await runAtomic(async (session) => {
            await Post.updateOne(
                { _id: post._id, isFeatured: true },
                { $set: { isFeatured: false, featuredAt: null, featuredBy: null, featuredOrder: 0 } },
                { session }
            );
            await recordAudit(
                req.actor,
                { action: AUDIT_ACTIONS.POST_UNFEATURE, targetType: "post", targetId: post._id, targetLabel: post.title, reason },
                { session }
            );
        });
    }

    return res.json({ success: true, message: featured ? "Post featured" : "Post unfeatured" });
}, "Failed to update featured status");

// GET /api/admin/featured — every featured entry, including ones currently hidden from the public
export const listFeaturedPosts = handle(async (req, res) => {
    const posts = await Post.find({ isFeatured: true })
        .setOptions({ withDeleted: true })
        .populate({ path: "author", select: "username fullName profileImage isDeleted", options: { withDeleted: true } })
        .populate("category", "name slug")
        .select("title slug excerpt coverImage status isDeleted author category featuredOrder featuredAt featuredBy createdAt")
        .sort({ featuredOrder: 1, featuredAt: -1 })
        .lean();

    const data = posts.map((post) => {
        let hiddenReason = null;
        if (post.isDeleted) hiddenReason = "deleted";
        else if (post.status !== "published") hiddenReason = "unpublished";
        return { ...post, visible: !hiddenReason, hiddenReason };
    });
    return res.json({ success: true, data: { posts: data } });
}, "Unable to load featured posts");

// PUT /api/admin/featured/order { ids: [postId, ...] } — new display order for the featured set
export const reorderFeaturedPosts = handle(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every(isValidId)) {
        throw new HttpError(400, "ids must be a list of post IDs");
    }
    if (new Set(ids.map(String)).size !== ids.length) throw new HttpError(400, "ids must not contain duplicates");

    // The new order must be exactly the current featured set, otherwise positions would collide
    const totalFeatured = await Post.countDocuments({ isFeatured: true }).setOptions({ withDeleted: true });
    const featured = await Post.countDocuments({ _id: { $in: ids }, isFeatured: true }).setOptions({ withDeleted: true });
    if (featured !== ids.length || totalFeatured !== ids.length) {
        throw new HttpError(400, "The new order must list every currently featured post exactly once");
    }

    await runAtomic(async (session) => {
        await Post.bulkWrite(
            ids.map((postId, index) => ({
                updateOne: { filter: { _id: postId, isFeatured: true }, update: { $set: { featuredOrder: index + 1 } } }
            })),
            { session }
        );
        await recordAudit(
            req.actor,
            { action: AUDIT_ACTIONS.FEATURED_REORDER, targetType: "post", targetId: null, metadata: { order: ids } },
            { session }
        );
    });

    return res.json({ success: true, message: "Featured order updated" });
}, "Failed to reorder featured posts");
