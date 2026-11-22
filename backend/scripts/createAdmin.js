// Retired. This script used to promote any account to "admin" by writing straight to the database,
// which bypasses the audit log and the Super Admin hierarchy.
//
// - First-time setup:   node scripts/provisionSuperAdmin.js --email <email> --apply
// - After that:         a Super Admin promotes admins and moderators from Admin > Management.
console.error(
    "scripts/createAdmin.js has been retired.\n" +
        "Provision the first Super Admin with: node scripts/provisionSuperAdmin.js --email <email> --apply\n" +
        "Then manage admins from the Admin Management page (Super Admin only). See docs/ADMIN_RBAC.md."
);
process.exit(1);
