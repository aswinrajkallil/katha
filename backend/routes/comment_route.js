import express from "express";
import { createComment, getComments } from "../controller/comment_controller.js";
import { authenticate, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Mounted at /api/posts/:postId/comments
router.post("/", authenticate, createComment);
router.get("/", optionalAuth, getComments);

export default router;
