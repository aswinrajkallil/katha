import mongoose from "mongoose";
import AdminAuditLog, { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "../models/AdminAuditLog.js";
import { handle, HttpError } from "../utils/httpError.js";
import { buildAuditScope, visibleActionsFor } from "../services/auditService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/admin/audit-logs?action=&targetType=&actor=&from=&to=&page=&limit=
// What comes back is always intersected with the caller's role scope (see buildAuditScope), so
// filters can narrow results but never widen them.
export const getAuditLogs = handle(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const filters = [];

    if (req.query.action) {
        if (!Object.values(AUDIT_ACTIONS).includes(req.query.action)) throw new HttpError(400, "Unknown action");
        filters.push({ action: req.query.action });
    }
    if (req.query.targetType) {
        if (!AUDIT_TARGET_TYPES.includes(req.query.targetType)) throw new HttpError(400, "Unknown target type");
        filters.push({ targetType: req.query.targetType });
    }
    if (req.query.actor) {
        if (!isValidId(req.query.actor)) throw new HttpError(400, "Invalid actor");
        filters.push({ actor: req.query.actor });
    }
    if (req.query.targetId) {
        if (!isValidId(req.query.targetId)) throw new HttpError(400, "Invalid target");
        filters.push({ targetId: req.query.targetId });
    }
    const createdAt = {};
    if (req.query.from) {
        if (!ISO_DAY.test(req.query.from)) throw new HttpError(400, "from must be YYYY-MM-DD");
        createdAt.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
    }
    if (req.query.to) {
        if (!ISO_DAY.test(req.query.to)) throw new HttpError(400, "to must be YYYY-MM-DD");
        createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    if (Object.keys(createdAt).length) filters.push({ createdAt });

    const query = { $and: [buildAuditScope(req.actor), ...filters] };
    const [logs, total] = await Promise.all([
        AdminAuditLog.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        AdminAuditLog.countDocuments(query)
    ]);

    return res.json({
        success: true,
        data: {
            logs,
            actions: visibleActionsFor(req.actor.role),
            scope: req.actor.role,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }
    });
}, "Unable to load activity logs");

// The log is append-only: there is deliberately no edit or delete handler. Anything other than GET
// on these paths gets an explicit 405 instead of falling through to some other route.
export const rejectAuditMutation = (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    res.set("Allow", "GET, HEAD");
    return res.status(405).json({ success: false, message: "Audit logs are append-only and cannot be modified" });
};
