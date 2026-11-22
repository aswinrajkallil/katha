import mongoose from "mongoose";
import User from "../models/User.js";
import PlatformSetting from "../models/PlatformSetting.js";
import { handle, HttpError } from "../utils/httpError.js";
import { runAtomic, transactionsSupported } from "../utils/transaction.js";
import { ROLE_VALUES, STAFF_ROLES, roleTransitionAction } from "../utils/permissions.js";
import { recordAudit, AUDIT_ACTIONS } from "../services/auditService.js";
import { SETTING_DEFINITIONS, getSettings } from "../services/settingsService.js";
import { normalizeReason, sameId } from "../services/moderationService.js";
import { emitToRoom } from "../socket.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/management/staff?role=&search=&status=&page=&limit=
export const listStaff = handle(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = ["active", "deleted", "all"].includes(req.query.status) ? req.query.status : "active";

    const role = req.query.role && req.query.role !== "all" ? req.query.role : null;
    if (role && !STAFF_ROLES.includes(role)) throw new HttpError(400, "role must be superadmin, admin, moderator or all");

    const filter = { role: role ? role : { $in: STAFF_ROLES } };
    if (status === "deleted") filter.isDeleted = true;
    if (search) {
        const regex = new RegExp(escapeRegex(search.slice(0, 100)), "i");
        filter.$or = [{ username: regex }, { email: regex }, { fullName: regex }];
    }
    const withDeleted = status !== "active";

    const [staff, total, superadmins, admins, moderators] = await Promise.all([
        User.find(filter)
            .setOptions({ withDeleted })
            .select("username fullName email profileImage role isDeleted createdAt roleChangedAt roleChangedBy lastActiveAt")
            .populate({ path: "roleChangedBy", select: "username", options: { withDeleted: true } })
            .sort({ role: 1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        User.countDocuments(filter).setOptions({ withDeleted }),
        User.countDocuments({ role: "superadmin" }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ role: "moderator" })
    ]);

    return res.json({
        success: true,
        data: {
            summary: { superadmins, admins, moderators },
            staff,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }
    });
}, "Unable to load administrators");

// PATCH /api/admin/management/users/:id/role  { role, confirm: true, reason? }
//
// The only code path that changes a role through the API. Guarantees:
//  - Super Admin only (route guard + re-checked from the database per request)
//  - explicit allowlist of transitions: user<->admin and user<->moderator
//  - never touches a Super Admin, never creates one, never self-targets
//  - compare-and-set on the current role so two concurrent changes cannot clobber each other
//  - audited in the same transaction (or reverted if the audit write fails on a standalone server)
export const changeUserRole = handle(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) throw new HttpError(400, "Invalid user ID");

    const { role: newRole, confirm } = req.body || {};
    if (confirm !== true) throw new HttpError(400, "Confirm the role change before submitting");
    if (typeof newRole !== "string" || !ROLE_VALUES.includes(newRole)) throw new HttpError(400, "Invalid role");
    const reason = normalizeReason(req.body?.reason);

    const actor = req.actor;
    if (sameId(actor._id, id)) throw new HttpError(403, "You cannot change your own role");

    // Deactivated accounts are hidden by the model, so they are "not found" here: restore first.
    const target = await User.findById(id).select("username role roleChangedAt roleChangedBy");
    if (!target) throw new HttpError(404, "User not found");

    if (target.role === "superadmin") {
        throw new HttpError(403, "Super Admin roles cannot be changed through the API");
    }
    if (newRole === "superadmin") {
        throw new HttpError(403, "Super Admin accounts can only be provisioned on the server");
    }
    const action = roleTransitionAction(target.role, newRole);
    if (!action) {
        throw new HttpError(
            400,
            target.role === newRole
                ? `The account is already a ${newRole}`
                : `A ${target.role} cannot be changed directly to ${newRole}. Change them to a normal user first.`
        );
    }

    const now = new Date();
    const previous = { role: target.role, roleChangedAt: target.roleChangedAt, roleChangedBy: target.roleChangedBy };

    await runAtomic(async (session) => {
        const result = await User.updateOne(
            { _id: target._id, role: target.role },
            { $set: { role: newRole, roleChangedAt: now, roleChangedBy: actor._id } },
            { session }
        );
        if (result.matchedCount === 0) {
            throw new HttpError(409, "The account's role changed in the meantime. Refresh and try again.");
        }
        try {
            await recordAudit(
                actor,
                {
                    action,
                    targetType: "user",
                    targetId: target._id,
                    targetLabel: `@${target.username}`,
                    reason,
                    metadata: { from: target.role, to: newRole, actingSuperAdmin: actor.username }
                },
                { session, strict: true }
            );
        } catch (error) {
            // Without a transaction there is nothing to roll back automatically, and a role change
            // must never exist without its audit entry: undo it.
            if (!session) {
                await User.updateOne(
                    { _id: target._id, role: newRole, roleChangedAt: now },
                    { $set: previous }
                ).catch((revertError) => console.error("ROLE REVERT FAILED:", revertError));
            }
            throw error;
        }
    });

    // Let any open session of the affected user refresh its role immediately
    emitToRoom(`user:${target._id}`, "auth:role-changed", { role: newRole });

    return res.json({
        success: true,
        message: `@${target.username} is now ${newRole === "user" ? "a normal user" : `a${newRole === "admin" ? "n" : ""} ${newRole}`}`,
        data: { _id: target._id, username: target.username, role: newRole, roleChangedAt: now }
    });
}, "Failed to change role");

// ---- Settings (Super Admin) -------------------------------------------------------------------

// GET /api/admin/settings
export const getAdminSettings = handle(async (req, res) => {
    const [settings, superadmins, admins, moderators, atomic] = await Promise.all([
        getSettings(),
        User.countDocuments({ role: "superadmin" }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ role: "moderator" }),
        transactionsSupported()
    ]);
    return res.json({
        success: true,
        data: {
            settings,
            definitions: SETTING_DEFINITIONS,
            system: {
                staff: { superadmins, admins, moderators },
                transactionsSupported: atomic,
                environment: process.env.NODE_ENV || "development"
            }
        }
    });
}, "Unable to load settings");

// PATCH /api/admin/settings { registrationOpen?: boolean, reason? }
export const updateAdminSettings = handle(async (req, res) => {
    const body = req.body || {};
    const reason = normalizeReason(body.reason);
    const updates = {};
    for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
        if (body[key] === undefined) continue;
        if (typeof body[key] !== def.type) throw new HttpError(400, `${key} must be a ${def.type}`);
        updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) throw new HttpError(400, "No valid settings supplied");

    const current = await getSettings();
    const changed = Object.entries(updates).filter(([key, value]) => current[key] !== value);
    if (changed.length === 0) return res.json({ success: true, message: "Settings unchanged", data: { settings: current } });

    await runAtomic(async (session) => {
        for (const [key, value] of changed) {
            await PlatformSetting.updateOne(
                { key },
                { $set: { value, updatedBy: req.actor._id } },
                { upsert: true, session }
            );
        }
        await recordAudit(
            req.actor,
            {
                action: AUDIT_ACTIONS.SETTING_UPDATE,
                targetType: "setting",
                targetLabel: changed.map(([key]) => key).join(", "),
                reason,
                metadata: { changes: Object.fromEntries(changed.map(([key, value]) => [key, { from: current[key], to: value }])) }
            },
            { session }
        );
    });

    return res.json({ success: true, message: "Settings updated", data: { settings: await getSettings() } });
}, "Failed to update settings");
