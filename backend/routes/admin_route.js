import express from "express";
import { authenticate, requireModeratorOrAbove, requirePermission } from "../middleware/authMiddleware.js";
import rateLimit from "../middleware/rateLimit.js";
import {
    getAdminStats,
    getAdminUsers,
    getAdminUserById,
    getAdminUserPosts,
    getAdminPosts,
    deleteAdminPost,
    restoreAdminPost,
    permanentlyDeleteAdminPost,
    deleteAdminUser,
    restoreAdminUser,
    permanentlyDeleteAdminUser
} from "../controller/admin_controller.js";
import {
    editAdminPost,
    setAdminPostStatus,
    getAdminPostHistory,
    setPostFeatured,
    listFeaturedPosts,
    reorderFeaturedPosts
} from "../controller/admin_post_controller.js";
import {
    listAdminComments,
    getAdminComment,
    removeAdminComment,
    restoreAdminComment,
    purgeAdminComment
} from "../controller/admin_comment_controller.js";
import { listReports, getReport, assignReport, resolveReport } from "../controller/report_controller.js";
import { getAnalytics, getDashboardTrends } from "../controller/admin_analytics_controller.js";
import { getAuditLogs, rejectAuditMutation } from "../controller/admin_audit_controller.js";
import {
    listStaff,
    changeUserRole,
    getAdminSettings,
    updateAdminSettings
} from "../controller/admin_management_controller.js";

const router = express.Router();

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: "Too many admin requests. Please try again later."
});

// 1. Authenticate (loads the CURRENT role from the database), 2. be staff at all, 3. rate limit.
// Every route below then adds the specific permission it needs, so being a moderator never
// grants access to an admin-only endpoint.
router.use(authenticate, requireModeratorOrAbove, adminLimiter);

const can = requirePermission;

// Dashboard & analytics (Admin, Super Admin)
router.get("/stats", can("dashboard:view"), getAdminStats);
router.get("/trends", can("dashboard:view"), getDashboardTrends);
router.get("/analytics", can("analytics:view"), getAnalytics);

// Users (Admin, Super Admin)
router.get("/users", can("users:view"), getAdminUsers);
router.get("/users/:id", can("users:view"), getAdminUserById);
router.get("/users/:id/posts", can("users:view"), getAdminUserPosts);
router.delete("/users/:id", can("users:deactivate"), deleteAdminUser);
router.patch("/users/:id/restore", can("users:restore"), restoreAdminUser);
router.delete("/users/:id/permanent", can("users:purge"), permanentlyDeleteAdminUser);

// Posts. Viewing/removing/restoring is open to moderators; editing, publishing, featuring and
// permanent deletion are not.
router.get("/posts", can("posts:view"), getAdminPosts);
router.get("/posts/:id/history", can("posts:view"), getAdminPostHistory);
router.patch("/posts/:id", can("posts:edit"), editAdminPost);
router.patch("/posts/:id/status", can("posts:publish"), setAdminPostStatus);
router.patch("/posts/:id/feature", can("posts:feature"), setPostFeatured);
router.delete("/posts/:id", can("posts:remove"), deleteAdminPost);
router.patch("/posts/:id/restore", can("posts:restore"), restoreAdminPost);
router.delete("/posts/:id/permanent", can("posts:purge"), permanentlyDeleteAdminPost);

// Featured posts (Admin, Super Admin)
router.get("/featured", can("featured:manage"), listFeaturedPosts);
router.put("/featured/order", can("featured:manage"), reorderFeaturedPosts);

// Comments
router.get("/comments", can("comments:view"), listAdminComments);
router.get("/comments/:id", can("comments:view"), getAdminComment);
router.delete("/comments/:id", can("comments:remove"), removeAdminComment);
router.patch("/comments/:id/restore", can("comments:restore"), restoreAdminComment);
router.delete("/comments/:id/permanent", can("comments:purge"), purgeAdminComment);

// Reports (all staff)
router.get("/reports", can("reports:view"), listReports);
router.get("/reports/:id", can("reports:view"), getReport);
router.patch("/reports/:id/assign", can("reports:manage"), assignReport);
router.post("/reports/:id/resolve", can("reports:manage"), resolveReport);

// Activity log: read-only. The scope of what each role sees is applied inside the controller.
router.all("/audit-logs", rejectAuditMutation);
router.all("/audit-logs/*splat", rejectAuditMutation);
router.get("/audit-logs", can("audit:view"), getAuditLogs);

// Super Admin only: admin management and platform settings
router.get("/management/staff", can("roles:manage"), listStaff);
router.patch("/management/users/:id/role", can("roles:manage"), changeUserRole);
router.get("/settings", can("settings:manage"), getAdminSettings);
router.patch("/settings", can("settings:manage"), updateAdminSettings);

export default router;
