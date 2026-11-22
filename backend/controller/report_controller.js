import mongoose from "mongoose";
import Report, { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES } from "../models/Report.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import { handle, HttpError } from "../utils/httpError.js";
import { runAtomic } from "../utils/transaction.js";
import { hasPermission, isStaffRole } from "../utils/permissions.js";
import { recordAudit, buildTargetHistoryScope, AUDIT_ACTIONS } from "../services/auditService.js";
import { removePost, removeComment, deactivateUser, normalizeReason, sameId } from "../services/moderationService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OPEN = ["pending", "under_review"];

// ---- Public: file a report --------------------------------------------------------------------

// POST /api/reports { targetType, targetId, reason, description }
export const createReport = handle(async (req, res) => {
    const { targetType, targetId, reason } = req.body || {};
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";

    if (!REPORT_TARGET_TYPES.includes(targetType)) throw new HttpError(400, "targetType must be post, comment or user");
    if (!isValidId(targetId)) throw new HttpError(400, "Invalid target");
    if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, "Invalid reason");
    if (description.length > 1000) throw new HttpError(400, "Description must be at most 1000 characters");
    if (reason === "other" && description.length < 5) throw new HttpError(400, "Please describe the problem");

    let owner = null;
    let label = "";
    if (targetType === "post") {
        // Only published, live posts can be reported (the model already hides deleted ones)
        const post = await Post.findOne({ _id: targetId, $or: [{ status: "published" }, { author: req.user.id }] }).select("title author");
        if (!post) throw new HttpError(404, "Post not found");
        owner = post.author;
        label = post.title;
    } else if (targetType === "comment") {
        const comment = await Comment.findOne({ _id: targetId, isDeleted: false }).select("content author");
        if (!comment) throw new HttpError(404, "Comment not found");
        owner = comment.author;
        label = comment.content;
    } else {
        const user = await User.findById(targetId).select("username");
        if (!user) throw new HttpError(404, "User not found");
        owner = user._id;
        label = `@${user.username}`;
    }

    if (sameId(owner, req.user.id)) {
        throw new HttpError(400, targetType === "user" ? "You cannot report yourself" : "You cannot report your own content");
    }

    try {
        const report = await Report.create({
            reporter: req.user.id,
            targetType,
            targetId,
            targetOwner: owner,
            targetLabel: label.slice(0, 200),
            reason,
            description
        });
        return res.status(201).json({ success: true, message: "Thanks, your report was submitted", data: { _id: report._id } });
    } catch (error) {
        // The unique (reporter, targetType, targetId) index is the real duplicate guard
        if (error.code === 11000) throw new HttpError(409, "You have already reported this");
        throw error;
    }
}, "Unable to submit report");

// ---- Staff ------------------------------------------------------------------------------------

const staffView = (report, actor) => {
    const mine = sameId(report.assignedTo?._id || report.assignedTo, actor._id);
    const open = OPEN.includes(report.status);
    return {
        ...report,
        permissions: {
            // Admins can pick up or reassign anything; moderators claim unassigned reports or work their own
            canAssign: open && (actor.role !== "moderator" || !report.assignedTo || mine),
            canResolve: open && (actor.role !== "moderator" || !report.assignedTo || mine)
        }
    };
};

// GET /api/admin/reports?status=&reason=&targetType=&assigned=me|unassigned|<userId>&search=&page=&limit=
export const listReports = handle(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const { status, reason, targetType, assigned } = req.query;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const filter = {};
    if (status === "open") filter.status = { $in: OPEN };
    else if (status) {
        if (!REPORT_STATUSES.includes(status)) throw new HttpError(400, "Invalid status");
        filter.status = status;
    }
    if (reason) {
        if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, "Invalid reason");
        filter.reason = reason;
    }
    if (targetType) {
        if (!REPORT_TARGET_TYPES.includes(targetType)) throw new HttpError(400, "Invalid target type");
        filter.targetType = targetType;
    }
    if (assigned === "me") filter.assignedTo = req.actor._id;
    else if (assigned === "unassigned") filter.assignedTo = null;
    else if (assigned) {
        if (!isValidId(assigned)) throw new HttpError(400, "Invalid assignee");
        filter.assignedTo = assigned;
    }
    if (search) {
        const regex = new RegExp(escapeRegex(search.slice(0, 100)), "i");
        filter.$or = [{ targetLabel: regex }, { description: regex }];
    }

    const [reports, total, openCount] = await Promise.all([
        Report.find(filter)
            .populate({ path: "reporter", select: "username profileImage", options: { withDeleted: true } })
            .populate({ path: "assignedTo", select: "username role", options: { withDeleted: true } })
            .populate({ path: "targetOwner", select: "username role isDeleted", options: { withDeleted: true } })
            .sort({ status: 1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Report.countDocuments(filter),
        Report.countDocuments({ status: { $in: OPEN } })
    ]);

    return res.json({
        success: true,
        data: {
            reports: reports.map((r) => staffView(r, req.actor)),
            openCount,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }
    });
}, "Unable to load reports");

// Everything a reviewer needs to judge the report without leaving the page
const loadTarget = async (report) => {
    if (report.targetType === "post") {
        const post = await Post.findOne({ _id: report.targetId })
            .setOptions({ withDeleted: true })
            .populate({ path: "author", select: "username fullName profileImage role isDeleted", options: { withDeleted: true } })
            .select("title slug excerpt content status isDeleted author createdAt moderationReason")
            .lean();
        return post ? { ...post, exists: true } : { exists: false };
    }
    if (report.targetType === "comment") {
        const comment = await Comment.findById(report.targetId)
            .populate({ path: "author", select: "username fullName profileImage role isDeleted", options: { withDeleted: true } })
            .populate({ path: "post", select: "title slug", options: { withDeleted: true } })
            .select("content author post isDeleted createdAt moderationReason")
            .lean();
        return comment ? { ...comment, exists: true } : { exists: false };
    }
    const user = await User.findOne({ _id: report.targetId })
        .setOptions({ withDeleted: true })
        .select("username fullName profileImage role isDeleted bio createdAt")
        .lean();
    return user ? { ...user, exists: true } : { exists: false };
};

// GET /api/admin/reports/:id
export const getReport = handle(async (req, res) => {
    if (!isValidId(req.params.id)) throw new HttpError(400, "Invalid report ID");
    const report = await Report.findById(req.params.id)
        .populate({ path: "reporter", select: "username fullName profileImage", options: { withDeleted: true } })
        .populate({ path: "assignedTo", select: "username role", options: { withDeleted: true } })
        .populate({ path: "resolvedBy", select: "username role", options: { withDeleted: true } })
        .populate({ path: "targetOwner", select: "username role isDeleted", options: { withDeleted: true } })
        .lean();
    if (!report) throw new HttpError(404, "Report not found");

    const [target, otherReports, history] = await Promise.all([
        loadTarget(report),
        Report.countDocuments({ targetType: report.targetType, targetId: report.targetId, _id: { $ne: report._id } }),
        AdminAuditLog.find({ $or: [{ targetType: "report", targetId: report._id }, { targetType: report.targetType, targetId: report.targetId }], ...buildTargetHistoryScope(req.actor) })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
    ]);

    return res.json({ success: true, data: { report: staffView(report, req.actor), target, otherReports, history } });
}, "Unable to load report");

const loadOpenReport = async (id) => {
    if (!isValidId(id)) throw new HttpError(400, "Invalid report ID");
    const report = await Report.findById(id);
    if (!report) throw new HttpError(404, "Report not found");
    return report;
};

// A moderator may not take over a report that someone else is already handling
const assertMayWork = (actor, report) => {
    if (actor.role === "moderator" && report.assignedTo && !sameId(report.assignedTo, actor._id)) {
        throw new HttpError(403, "This report is assigned to someone else");
    }
};

// PATCH /api/admin/reports/:id/assign { assignTo: "me" | userId | null }
export const assignReport = handle(async (req, res) => {
    const report = await loadOpenReport(req.params.id);
    if (!OPEN.includes(report.status)) throw new HttpError(409, "This report is already closed");
    assertMayWork(req.actor, report);

    const raw = req.body?.assignTo;
    let assignee = null;
    if (raw === "me") assignee = req.actor;
    else if (raw === null || raw === undefined || raw === "") assignee = null;
    else {
        if (!isValidId(raw)) throw new HttpError(400, "Invalid assignee");
        if (req.actor.role === "moderator" && !sameId(raw, req.actor._id)) {
            throw new HttpError(403, "Moderators can only assign reports to themselves");
        }
        assignee = await User.findById(raw).select("username role");
        if (!assignee || !isStaffRole(assignee.role)) throw new HttpError(400, "Reports can only be assigned to staff");
    }
    const reason = normalizeReason(req.body?.reason);

    await runAtomic(async (session) => {
        await Report.updateOne(
            { _id: report._id, status: { $in: OPEN } },
            { $set: { assignedTo: assignee ? assignee._id : null, status: assignee ? "under_review" : "pending" } },
            { session }
        );
        await recordAudit(
            req.actor,
            {
                action: assignee ? AUDIT_ACTIONS.REPORT_ASSIGN : AUDIT_ACTIONS.REPORT_UNASSIGN,
                targetType: "report",
                targetId: report._id,
                targetLabel: report.targetLabel,
                reason,
                metadata: { assignedTo: assignee ? assignee.username : null, reportTarget: `${report.targetType}:${report.targetId}` }
            },
            { session }
        );
    });
    return res.json({ success: true, message: assignee ? "Report assigned" : "Report unassigned" });
}, "Failed to assign report");

// POST /api/admin/reports/:id/resolve { outcome: "resolved"|"dismissed", action: "none"|"remove_content"|"deactivate_account", resolution }
//
// "Take moderation action" and "resolve" are one step so the report and the action stay consistent:
// the action is authorised through the same service functions the direct endpoints use, so a
// moderator cannot do through a report what they could not do directly.
export const resolveReport = handle(async (req, res) => {
    const report = await loadOpenReport(req.params.id);
    if (!OPEN.includes(report.status)) throw new HttpError(409, "This report is already closed");
    assertMayWork(req.actor, report);

    const outcome = req.body?.outcome;
    if (!["resolved", "dismissed"].includes(outcome)) throw new HttpError(400, "outcome must be resolved or dismissed");
    const action = req.body?.action || "none";
    if (!["none", "remove_content", "deactivate_account"].includes(action)) throw new HttpError(400, "Invalid action");
    if (outcome === "dismissed" && action !== "none") throw new HttpError(400, "A dismissed report cannot carry a moderation action");
    const resolution = normalizeReason(req.body?.resolution, { required: true, min: 3 });

    if (action === "remove_content") {
        if (report.targetType === "user") throw new HttpError(400, "Use deactivate_account for user reports");
        await (report.targetType === "post"
            ? removePost(req.actor, report.targetId, { reason: resolution })
            : removeComment(req.actor, report.targetId, { reason: resolution })
        ).catch((error) => {
            // Already gone is fine: the content the report was about no longer exists publicly
            if (error instanceof HttpError && error.status === 404) return null;
            if (error instanceof HttpError && error.status === 409) return null;
            throw error;
        });
    } else if (action === "deactivate_account") {
        if (!hasPermission(req.actor.role, "users:deactivate")) {
            throw new HttpError(403, "You do not have permission to deactivate accounts");
        }
        const accountId = report.targetType === "user" ? report.targetId : report.targetOwner;
        if (!accountId) throw new HttpError(400, "There is no account to deactivate");
        await deactivateUser(req.actor, accountId, { reason: resolution });
    }

    const now = new Date();
    await runAtomic(async (session) => {
        // Close every open report about the same target at once, so duplicates don't linger
        const sameTarget = outcome === "resolved" && action !== "none";
        await Report.updateMany(
            sameTarget
                ? { targetType: report.targetType, targetId: report.targetId, status: { $in: OPEN } }
                : { _id: report._id, status: { $in: OPEN } },
            { $set: { status: outcome, resolution, resolutionAction: action, resolvedBy: req.actor._id, resolvedAt: now, assignedTo: report.assignedTo || req.actor._id } },
            { session }
        );
        await recordAudit(
            req.actor,
            {
                action: outcome === "resolved" ? AUDIT_ACTIONS.REPORT_RESOLVE : AUDIT_ACTIONS.REPORT_DISMISS,
                targetType: "report",
                targetId: report._id,
                targetLabel: report.targetLabel,
                reason: resolution,
                metadata: { reportTarget: `${report.targetType}:${report.targetId}`, reason: report.reason, actionTaken: action }
            },
            { session }
        );
    });

    return res.json({ success: true, message: outcome === "resolved" ? "Report resolved" : "Report dismissed" });
}, "Failed to resolve report");

