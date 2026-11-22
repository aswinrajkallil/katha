import mongoose from "mongoose";

export const AUDIT_ACTIONS = Object.freeze({
    // Roles (Super Admin only)
    ROLE_PROMOTE_ADMIN: "role.promote_admin",
    ROLE_DEMOTE_ADMIN: "role.demote_admin",
    ROLE_PROMOTE_MODERATOR: "role.promote_moderator",
    ROLE_DEMOTE_MODERATOR: "role.demote_moderator",
    ROLE_PROVISION_SUPERADMIN: "role.provision_superadmin",

    // Accounts
    USER_DEACTIVATE: "user.deactivate",
    USER_RESTORE: "user.restore",
    USER_PURGE: "user.purge",
    USER_PURGE_FAILED: "user.purge_failed",

    // Posts
    POST_REMOVE: "post.remove",
    POST_RESTORE: "post.restore",
    POST_PURGE: "post.purge",
    POST_EDIT: "post.edit",
    POST_PUBLISH: "post.publish",
    POST_UNPUBLISH: "post.unpublish",
    POST_FEATURE: "post.feature",
    POST_UNFEATURE: "post.unfeature",
    FEATURED_REORDER: "featured.reorder",

    // Comments
    COMMENT_REMOVE: "comment.remove",
    COMMENT_RESTORE: "comment.restore",
    COMMENT_PURGE: "comment.purge",
    COMMENT_EDIT: "comment.edit",

    // Reports
    REPORT_ASSIGN: "report.assign",
    REPORT_UNASSIGN: "report.unassign",
    REPORT_RESOLVE: "report.resolve",
    REPORT_DISMISS: "report.dismiss",

    // Categories
    CATEGORY_CREATE: "category.create",
    CATEGORY_UPDATE: "category.update",
    CATEGORY_DELETE: "category.delete",

    // Privileged platform settings
    SETTING_UPDATE: "setting.update"
});

export const AUDIT_TARGET_TYPES = Object.freeze([
    "user",
    "post",
    "comment",
    "report",
    "category",
    "setting",
    "system"
]);

const auditSchema = new mongoose.Schema(
    {
        // null for actions performed by the server-side provisioning script
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        // Snapshots, so the log stays readable even after the actor's account is purged
        actorRole: { type: String, required: true },
        actorUsername: { type: String, default: null },
        action: { type: String, required: true, enum: Object.values(AUDIT_ACTIONS) },
        targetType: { type: String, required: true, enum: AUDIT_TARGET_TYPES },
        targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
        targetLabel: { type: String, default: null, maxlength: 200 },
        reason: { type: String, default: "", maxlength: 1000 },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

// Append-only. The application has no edit/delete route for audit entries, and these hooks make
// the model itself refuse modification so a future bug cannot quietly rewrite history.
const immutable = () => {
    throw new Error("Audit log entries are append-only and cannot be modified or deleted");
};

auditSchema.pre(
    [
        "updateOne",
        "updateMany",
        "findOneAndUpdate",
        "findOneAndReplace",
        "replaceOne",
        "deleteOne",
        "deleteMany",
        "findOneAndDelete"
    ],
    immutable
);
auditSchema.pre("deleteOne", { document: true, query: false }, immutable);
auditSchema.pre("save", function () {
    if (!this.isNew) immutable();
});

const AdminAuditLog = mongoose.model("AdminAuditLog", auditSchema);
export default AdminAuditLog;
