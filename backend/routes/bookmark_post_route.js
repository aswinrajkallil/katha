import express from "express";
import {
    getBookmarkStatus,
    addBookmark,
    removeBookmark
} from "../controller/bookmark_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Mounted at /api/posts/:postId
router.get("/bookmark", authenticate, getBookmarkStatus);
router.post("/bookmark", authenticate, addBookmark);
router.delete("/bookmark", authenticate, removeBookmark);

export default router;
