import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Report from "../models/Report.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import { handle, HttpError } from "../utils/httpError.js";
import { canModerateContentOf, isAdminRole } from "../utils/permissions.js";
import { buildTargetHistoryScope } from "../services/auditService.js";
import {
    removeComment,
    restoreRemovedComment,
    purgeComment,
    PLACEHOLDER
} from "../services/moderationService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const requireValidId = (id, label = "ID") => {
    if (!isValidId(id)) throw new HttpError(400, `Invalid ${label}`);
};

const resolveUserFilter = async (value) => {
    const key = String(value);
    const user = await User.findOne(isValidId(key) ? { _id: key } : { username: key.toLowerCase() })
        .setOptions({ withDeleted: true })
        .select("_id");
    // An unknown user is an empty result rather than an error
    return user ? user._id : new mongoose.Types.ObjectId();
};

// GET /api/admin/comments?search=&author=&post=&status=active|deleted|all&page=&limit=
export const listAdminComments = handle(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const status = ["active", "deleted", "all"].includes(req.query.status) ? req.query.status : "active";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const filter = {};
    if (status === "active") filter.isDeleted = false;
    if (status === "deleted") filter.isDeleted = true;
    if (search) filter.content = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    if (req.query.author) filter.author = await resolveUserFilter(req.query.author);
    if (req.query.post) {
        requireValidId(req.query.post, "post filter");
        filter.post = req.query.post;
    }

    const [comments, total] = await Promise.all([
        Comment.find(filter)
            .populate({ path: "author", select: "username fullName profileImage role isDeleted", options: { withDeleted: true } })
            .populate({ path: "deletedBy", select: "username role", options: { withDeleted: true } })
            .populate({ path: "post", select: "title slug status isDeleted", options: { withDeleted: true } })
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Comment.countDocuments(filter)
    ]);

    const ids = comments.map((c) => c._id);
    const [replyAgg, reportAgg] = await Promise.all([
        Comment.aggregate([
            { $match: { parentComment: { $in: ids } } },
            { $group: { _id: "$parentComment", count: { $sum: 1 } } }
        ]),
        Report.aggregate([
            { $match: { targetType: "comment", targetId: { $in: ids }, status: { $in: ["pending", "under_review"] } } },
            { $group: { _id: "$targetId", count: { $sum: 1 } } }
        ])
    ]);
    const replyMap = new Map(replyAgg.map((r) => [r._id.toString(), r.count]));
    const reportMap = new Map(reportAgg.map((r) => [r._id.toString(), r.count]));

    const actorRole = req.actor.role;
    const data = comments.map((c) => {
        const authorRole = c.author?.role || "user";
        const own = c.author && c.author._id.toString() === req.actor._id.toString();
        const mayModerate = own || canModerateContentOf(actorRole, authorRole);
        const removedByStaff = c.isDeleted && c.deletedBy && c.deletedBy._id.toString() !== c.author?._id?.toString();
        const restorable = removedByStaff && c.content !== PLACEHOLDER;
        return {
            ...c,
            likesCount: Array.isArray(c.likes) ? c.likes.length : 0,
            likes: undefined,
            repliesCount: replyMap.get(c._id.toString()) || 0,
            openReports: reportMap.get(c._id.toString()) || 0,
            permissions: {
                canRemove: mayModerate && !c.isDeleted,
                canRestore: mayModerate && restorable && (actorRole !== "moderator" || c.deletedBy._id.toString() === req.actor._id.toString()),
                canPurge: mayModerate && c.isDeleted && isAdminRole(actorRole)
            }
        };
    });

    return res.json({
        success: true,
        data: { comments: data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
    });
}, "Unable to load comments");

// GET /api/admin/comments/:id — the comment, its parent post, its author, its replies and its history
export const getAdminComment = handle(async (req, res) => {
    const { id } = req.params;
    requireValidId(id, "comment ID");

    const comment = await Comment.findById(id)
        .populate({ path: "author", select: "username fullName profileImage role isDeleted", options: { withDeleted: true } })
        .populate({ path: "deletedBy", select: "username role", options: { withDeleted: true } })
        .populate({ path: "post", select: "title slug status isDeleted author", options: { withDeleted: true } })
        .lean();
    if (!comment) throw new HttpError(404, "Comment not found");

    const [parent, replies, history] = await Promise.all([
        comment.parentComment
            ? Comment.findById(comment.parentComment)
                  .populate({ path: "author", select: "username profileImage", options: { withDeleted: true } })
                  .select("content author isDeleted createdAt")
                  .lean()
            : null,
        Comment.find({ parentComment: comment._id })
            .populate({ path: "author", select: "username fullName profileImage role", options: { withDeleted: true } })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean(),
        AdminAuditLog.find({ targetType: "comment", targetId: comment._id, ...buildTargetHistoryScope(req.actor) })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
    ]);

    return res.json({
        success: true,
        data: {
            comment: { ...comment, likesCount: comment.likes?.length || 0, likes: undefined },
            parent,
            replies: replies.map((r) => ({ ...r, likesCount: r.likes?.length || 0, likes: undefined })),
            history
        }
    });
}, "Unable to load comment");

// DELETE /api/admin/comments/:id { reason }
export const removeAdminComment = handle(async (req, res) => {
    requireValidId(req.params.id, "comment ID");
    await removeComment(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({ success: true, message: "Comment removed", commentId: req.params.id });
}, "Failed to remove comment");

// PATCH /api/admin/comments/:id/restore
export const restoreAdminComment = handle(async (req, res) => {
    requireValidId(req.params.id, "comment ID");
    await restoreRemovedComment(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({ success: true, message: "Comment restored", commentId: req.params.id });
}, "Failed to restore comment");

// DELETE /api/admin/comments/:id/permanent
export const purgeAdminComment = handle(async (req, res) => {
    requireValidId(req.params.id, "comment ID");
    const { mode } = await purgeComment(req.actor, req.params.id, { reason: req.body?.reason });
    return res.json({
        success: true,
        message: mode === "tombstoned"
            ? "Comment permanently removed. A placeholder was kept so its replies stay in place."
            : "Comment permanently deleted",
        mode
    });
}, "Failed to delete comment");

