import mongoose from "mongoose";
import AdminAuditLog, { AUDIT_ACTIONS } from "../models/AdminAuditLog.js";

// Keys that must never be persisted, whatever a caller passes in.
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|hash|api[_-]?key|credential|private/i;
const MAX_DEPTH = 4;
const MAX_STRING = 1000;
const MAX_ARRAY = 50;
const MAX_BYTES = 16 * 1024;

const sanitizeValue = (value, depth) => {
    if (value === null || value === undefined) return value ?? null;
    if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    if (typeof value === "function" || typeof value === "symbol" || Buffer.isBuffer(value)) return undefined;
    if (depth >= MAX_DEPTH) return "[truncated]";
    if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
    }
    if (typeof value === "object") {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            if (SENSITIVE_KEY.test(key)) continue;
            const clean = sanitizeValue(inner, depth + 1);
            if (clean !== undefined) out[key] = clean;
        }
        return out;
    }
    return undefined;
};

export const sanitizeMetadata = (metadata) => {
    const clean = sanitizeValue(metadata ?? {}, 0);
    const safe = clean && typeof clean === "object" && !Array.isArray(clean) ? clean : { value: clean };
    return Buffer.byteLength(JSON.stringify(safe)) > MAX_BYTES ? { truncated: true } : safe;
};

const describeActor = (actor) => {
    if (!actor) return { actor: null, actorRole: "system", actorUsername: null };
    return {
        actor: actor._id || actor.id || null,
        actorRole: actor.role,
        actorUsername: actor.username || null
    };
};

/**
 * Append one audit entry.
 *
 * @param actor   the authenticated staff user (req.actor), or null for server-side scripts
 * @param entry   { action, targetType, targetId, targetLabel, reason, metadata }
 * @param session optional Mongo session so the entry commits atomically with the action it records
 *
 * With a session the write is strict (a failure aborts the transaction). Without one a failure
 * is logged loudly and swallowed unless `strict: true`, so a logging problem cannot turn an
 * already-completed action into a confusing 500.
 */
export const recordAudit = async (actor, entry, { session = null, strict = false } = {}) => {
    const doc = {
        ...describeActor(actor),
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        targetLabel: entry.targetLabel ? String(entry.targetLabel).slice(0, 200) : null,
        reason: entry.reason ? String(entry.reason).trim().slice(0, 1000) : "",
        metadata: sanitizeMetadata(entry.metadata)
    };

    try {
        const [created] = await AdminAuditLog.create([doc], session ? { session } : {});
        return created;
    } catch (error) {
        if (session || strict) throw error;
        console.error("AUDIT WRITE FAILED - manual follow-up required:", JSON.stringify(doc), error);
        return null;
    }
};

// ---- Visibility -------------------------------------------------------------------------------
// Super Admin: everything. Admin: everything except role changes, settings and system entries.
// Moderator: only their own content-moderation and report actions.

const MODERATOR_ACTIONS = [
    AUDIT_ACTIONS.POST_REMOVE,
    AUDIT_ACTIONS.POST_RESTORE,
    AUDIT_ACTIONS.COMMENT_REMOVE,
    AUDIT_ACTIONS.COMMENT_RESTORE,
    AUDIT_ACTIONS.REPORT_ASSIGN,
    AUDIT_ACTIONS.REPORT_UNASSIGN,
    AUDIT_ACTIONS.REPORT_RESOLVE,
    AUDIT_ACTIONS.REPORT_DISMISS
];

const SUPERADMIN_ONLY_PREFIX = /^(role|setting|system)\./;

export const buildAuditScope = (actor) => {
    if (actor.role === "superadmin") return {};
    if (actor.role === "admin") return { action: { $not: SUPERADMIN_ONLY_PREFIX } };
    if (actor.role === "moderator") {
        return { actor: actor._id, action: { $in: MODERATOR_ACTIONS } };
    }
    return { _id: null }; // matches nothing
};

// Actions a role may filter by in the activity log UI.
export const visibleActionsFor = (role) => {
    const all = Object.values(AUDIT_ACTIONS);
    if (role === "superadmin") return all;
    if (role === "admin") return all.filter((action) => !SUPERADMIN_ONLY_PREFIX.test(action));
    if (role === "moderator") return MODERATOR_ACTIONS;
    return [];
};

// History of one post/comment/etc. shown on its detail view. Moderators see every moderation
// action on that target (not only their own) so two moderators do not undo each other blindly.
export const buildTargetHistoryScope = (actor) => {
    if (actor.role === "superadmin") return {};
    if (actor.role === "admin") return { action: { $not: SUPERADMIN_ONLY_PREFIX } };
    if (actor.role === "moderator") return { action: { $in: MODERATOR_ACTIONS } };
    return { _id: null };
};

export { AUDIT_ACTIONS };
