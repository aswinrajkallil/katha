import express from "express";
import { authenticate, requireAdminDb } from "../middleware/authMiddleware.js";
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

const router = express.Router();

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many admin requests. Please try again later."
});

// Protect all admin routes with authentication, DB role verification, and rate limiting
router.use(authenticate, requireAdminDb, adminLimiter);

router.get("/stats", getAdminStats);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.get("/users/:id/posts", getAdminUserPosts);
router.get("/posts", getAdminPosts);
// Soft delete, restore, and permanent delete (permanent only works on already-deleted items)
router.delete("/posts/:id", deleteAdminPost);
router.patch("/posts/:id/restore", restoreAdminPost);
router.delete("/posts/:id/permanent", permanentlyDeleteAdminPost);
router.delete("/users/:id", deleteAdminUser);
router.patch("/users/:id/restore", restoreAdminUser);
router.delete("/users/:id/permanent", permanentlyDeleteAdminUser);

export default router;
