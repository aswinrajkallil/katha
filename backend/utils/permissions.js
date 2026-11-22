// Single source of truth for roles and permissions.
//
// Roles are ranked: superadmin > admin > moderator > user. Every privileged endpoint maps to a
// named permission below, so "who may do what" is declared here once instead of being scattered
// through route files as ad-hoc role comparisons.

export const ROLE_VALUES = Object.freeze(["superadmin", "admin", "moderator", "user"]);
export const STAFF_ROLES = Object.freeze(["superadmin", "admin", "moderator"]);

const RANK = Object.freeze({ superadmin: 4, admin: 3, moderator: 2, user: 1 });

export const roleRank = (role) => RANK[role] || 0;
export const isStaffRole = (role) => STAFF_ROLES.includes(role);
// "Admin level" = may act as an administrator (admin or superadmin). Moderators are NOT included.
export const isAdminRole = (role) => role === "admin" || role === "superadmin";

const SA = "superadmin";
const AD = "admin";
const MO = "moderator";

export const PERMISSIONS = Object.freeze({
    "dashboard:view": [SA, AD],
    "analytics:view": [SA, AD],

    "users:view": [SA, AD],
    "users:deactivate": [SA, AD],
    "users:restore": [SA, AD],
    "users:purge": [SA, AD],
    "roles:manage": [SA],

    "posts:view": [SA, AD, MO],
    "posts:remove": [SA, AD, MO],
    "posts:restore": [SA, AD, MO],
    "posts:edit": [SA, AD],
    "posts:publish": [SA, AD],
    "posts:purge": [SA, AD],
    "posts:feature": [SA, AD],

    "comments:view": [SA, AD, MO],
    "comments:remove": [SA, AD, MO],
    "comments:restore": [SA, AD, MO],
    "comments:purge": [SA, AD],

    "reports:view": [SA, AD, MO],
    "reports:manage": [SA, AD, MO],

    "categories:manage": [SA, AD],
    "featured:manage": [SA, AD],

    // Audit scope differs by role (see auditService.buildAuditScope), but all staff may open the page.
    "audit:view": [SA, AD, MO],
    "settings:manage": [SA]
});

export const hasPermission = (role, permission) => {
    const allowed = PERMISSIONS[permission];
    return Boolean(allowed && allowed.includes(role));
};

export const permissionsFor = (role) =>
    Object.keys(PERMISSIONS).filter((permission) => PERMISSIONS[permission].includes(role));

// Account-level actions (deactivate / restore / purge) require the actor to strictly outrank the
// target. That single rule gives: superadmin can manage admins, moderators and users; admin can
// manage moderators and users but never another admin; nobody can manage a superadmin.
export const canManageAccount = (actorRole, targetRole) => roleRank(actorRole) > roleRank(targetRole);

// Content moderation (posts / comments written by someone else).
//  - superadmin: any content
//  - admin: any content except a superadmin's
//  - moderator: only content written by normal users (never by other staff)
export const canModerateContentOf = (actorRole, authorRole) => {
    if (actorRole === SA) return true;
    if (actorRole === AD) return authorRole !== SA;
    if (actorRole === MO) return authorRole === "user";
    return false;
};

// Explicit allowlist of role transitions an API call may perform. `superadmin` appears nowhere:
// Super Admins are provisioned server-side only, and an API call can neither create nor remove one.
export const ALLOWED_ROLE_TRANSITIONS = Object.freeze({
    "user->admin": "role.promote_admin",
    "admin->user": "role.demote_admin",
    "user->moderator": "role.promote_moderator",
    "moderator->user": "role.demote_moderator"
});

export const roleTransitionAction = (from, to) => ALLOWED_ROLE_TRANSITIONS[`${from}->${to}`] || null;
