import { useAuth } from "../../context/AuthContext";

// Mirrors backend/utils/permissions.js so the UI can hide what a role may not do.
// This is a convenience only: the API re-checks every request against the database.
const SA = "superadmin";
const AD = "admin";
const MO = "moderator";

export const PERMISSIONS = {
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
  "audit:view": [SA, AD, MO],
  "settings:manage": [SA],
};

export const STAFF_ROLES = [SA, AD, MO];
export const isStaff = (role) => STAFF_ROLES.includes(role);
export const hasPermission = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));

export const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
};

// The first admin page a role can open (where /admin sends them)
export const homeFor = (role) => {
  if (hasPermission(role, "dashboard:view")) return "/admin";
  if (hasPermission(role, "reports:view")) return "/admin/reports";
  return "/admin/login";
};

export function useAdminAccess() {
  const { user } = useAuth();
  const role = user?.role || "user";
  return {
    role,
    isStaff: isStaff(role),
    can: (permission) => hasPermission(role, permission),
  };
}

// Mirrors canModerateContentOf in the backend: moderators act only on normal users' content,
// admins on everyone's except a super admin's, and a super admin on anyone's.
export const canModerateContentOf = (actorRole, authorRole = "user") => {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return authorRole !== "superadmin";
  if (actorRole === "moderator") return (authorRole || "user") === "user";
  return false;
};
