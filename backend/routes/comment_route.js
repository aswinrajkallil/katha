import express from "express";
import { createComment, getComments, updateComment, deleteComment } from "../controller/comment_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Mounted at /api/posts/:postId/comments
router.post("/", authenticate, createComment);
router.get("/", getComments);

export default router;
