import express from "express";
import { likePost, unlikePost, getLikes } from "../controller/like_controller.js";
import authenticate, { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Mounted at /api/posts/:postId
router.post("/like", authenticate, likePost);
router.delete("/like", authenticate, unlikePost);
router.get("/likes", optionalAuth, getLikes);

export default router;
