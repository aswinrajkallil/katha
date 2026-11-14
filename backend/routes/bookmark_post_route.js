import express from "express";
import { addBookmark, removeBookmark } from "../controller/bookmark_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Mounted at /api/posts/:postId
router.post("/bookmark", authenticate, addBookmark);
router.delete("/bookmark", authenticate, removeBookmark);

export default router;
