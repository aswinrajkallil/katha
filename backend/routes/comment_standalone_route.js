import express from "express";
import { updateComment, deleteComment } from "../controller/comment_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router();

// /api/comments/:id
router.put("/:id", authenticate, updateComment);
router.delete("/:id", authenticate, deleteComment);

export default router;
