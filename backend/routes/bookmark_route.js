import express from "express";
import { addBookmark, removeBookmark, getBookmarks } from "../controller/bookmark_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router();

// /api/bookmarks
router.get("/", authenticate, getBookmarks);

export default router;
