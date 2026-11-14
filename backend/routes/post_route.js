import express from "express";
import {
    createPost,
    getPosts,
    getMyPosts,
    getUserPosts,
    getPostBySlug,
    getPostById,
    updatePost,
    deletePost
} from "../controller/post_controller.js";
import authenticate, { optionalAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Specific routes MUST come before parameterized /:id routes
router.get("/my", authenticate, getMyPosts);
router.get("/slug/:slug", optionalAuth, getPostBySlug);
router.get("/user/:userId", getUserPosts);

router.post("/", authenticate, upload.single("coverImage"), createPost);
router.get("/", optionalAuth, getPosts);
router.get("/:id", optionalAuth, getPostById);
router.put("/:id", authenticate, upload.single("coverImage"), updatePost);
router.delete("/:id", authenticate, deletePost);

export default router;
