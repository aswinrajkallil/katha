import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { hasPermission, isAdminRole } from "../utils/permissions.js";

// Authorization model
// -------------------
// The JWT proves *who* the caller is. It is never trusted for *what they may do*: every request
// re-reads the user from MongoDB, so a demotion or deactivation takes effect on the very next
// request instead of when the 15-minute access token expires. A deactivated (soft-deleted) user
// is filtered out by the User model, so they cannot authenticate at all.

const LAST_ACTIVE_REFRESH_MS = 5 * 60 * 1000;

const bearerToken = (req) => {
    const header = req.headers.authorization;
    return header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
};

// Throttled so presence tracking costs at most one extra write per user per 5 minutes.
const touchLastActive = (user) => {
    const last = user.lastActiveAt ? user.lastActiveAt.getTime() : 0;
    if (Date.now() - last < LAST_ACTIVE_REFRESH_MS) return;
    User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }, { timestamps: false })
        .catch(() => {});
};

const attachActor = (req, user) => {
    // `req.user` keeps the shape the rest of the codebase already reads (id / _id / role), but the
    // role now comes from the database, not from the token.
    req.user = { id: user._id.toString(), _id: user._id.toString(), role: user.role, username: user.username };
    req.actor = user;
    touchLastActive(user);
};

const authenticate = async (req, res, next) => {
    try {
        const token = bearerToken(req);
        if (!token) {
            return res.status(401).json({ success: false, message: "Authorization token required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("username role lastActiveAt");
        if (!user) {
            return res.status(401).json({ success: false, message: "Account not found or deactivated" });
        }

        attachActor(req, user);
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

// Optional auth: attaches the user if a valid token for an active account is present, but never blocks.
const optionalAuth = async (req, res, next) => {
    try {
        const token = bearerToken(req);
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select("username role lastActiveAt");
            if (user) attachActor(req, user);
        }
    } catch {
        // Invalid token: treat as unauthenticated, don't block
    }
    next();
};

// Guards re-use the user `authenticate` loaded for this request, and fetch fresh from the
// database if a route somehow mounts a guard without it, so they never fall back to the JWT claim.
const resolveActor = async (req) => {
    if (req.actor) return req.actor;
    if (!req.user?.id) return null;
    const user = await User.findById(req.user.id).select("username role");
    if (user) req.actor = user;
    return user;
};

const guard = (isAllowed, message) => async (req, res, next) => {
    try {
        const actor = await resolveActor(req);
        if (!actor) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        if (!isAllowed(actor.role)) {
            return res.status(403).json({ success: false, message });
        }
        next();
    } catch (error) {
        console.error("Authorization check error:", error);
        return res.status(500).json({ success: false, message: "Authorization check failed" });
    }
};

const requireRole = (...roles) => guard((role) => roles.includes(role), "You do not have permission to do that");

// Admin or Super Admin. Moderators are deliberately excluded.
const requireAdminDb = guard(isAdminRole, "Admin access required");
const requireSuperAdmin = requireRole("superadmin");
const requireModeratorOrAbove = requireRole("moderator", "admin", "superadmin");

// Prefer this on routes: it names the capability rather than a role list, and the mapping lives
// in utils/permissions.js.
const requirePermission = (permission) =>
    guard((role) => hasPermission(role, permission), "You do not have permission to do that");

export {
    authenticate,
    optionalAuth,
    requireRole,
    requireAdminDb,
    requireSuperAdmin,
    requireModeratorOrAbove,
    requirePermission
};
export default authenticate;
