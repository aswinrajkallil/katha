import express from "express";
import {
    updateComment,
    deleteComment,
    toggleLikeComment,
    likeComment,
    unlikeComment
} from "../controller/comment_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router();

// /api/comments/:id
router.put("/:id", authenticate, updateComment);
router.delete("/:id", authenticate, deleteComment);
router.post("/:id/like", authenticate, toggleLikeComment);
router.delete("/:id/like", authenticate, unlikeComment);

export default router;
