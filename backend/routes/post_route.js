import express from "express";
import {
    createPost,
    getPosts,
    getMyPosts,
    getSidebarPosts,
    getUserPosts,
    getPostBySlug,
    getPostById,
    updatePost,
    deletePost,
    getDeletedPosts,
    restorePost,
    permanentlyDeletePost
} from "../controller/post_controller.js";
import authenticate, { optionalAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import validateImage from "../middleware/validateImage.js";

const router = express.Router();

// Specific routes MUST come before parameterized /:id routes
router.get("/my", authenticate, getMyPosts);
router.get("/deleted", authenticate, getDeletedPosts);
router.get("/sidebar", optionalAuth, getSidebarPosts);
router.get("/slug/:slug", optionalAuth, getPostBySlug);
router.get("/user/:userId", getUserPosts);

router.post("/", authenticate, upload.single("coverImage"), validateImage, createPost);
router.get("/", optionalAuth, getPosts);
router.get("/:id", optionalAuth, getPostById);
router.put("/:id", authenticate, upload.single("coverImage"), validateImage, updatePost);
router.patch("/:id/restore", authenticate, restorePost);
router.delete("/:id/permanent", authenticate, permanentlyDeletePost);
router.delete("/:id", authenticate, deletePost);

export default router;
