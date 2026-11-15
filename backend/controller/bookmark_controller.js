import Bookmark from "../models/Bookmark.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/posts/:postId/bookmark
const getBookmarkStatus = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const bookmarked = await Bookmark.exists({
            user: req.user.id,
            post: postId
        });

        return res.status(200).json({
            success: true,
            data: { bookmarked: Boolean(bookmarked) }
        });
    } catch (e) {
        console.error("getBookmarkStatus error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// POST /api/posts/:postId/bookmark
const addBookmark = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(postId);
        if (!post || post.status !== "published") {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        try {
            await Bookmark.create({ user: req.user.id, post: postId });
        } catch (e) {
            if (e.code === 11000) {
                return res.status(409).json({ success: false, message: "Already bookmarked" });
            }
            throw e;
        }

        return res.status(201).json({ success: true, message: "Post bookmarked" });
    } catch (e) {
        console.error("addBookmark error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/posts/:postId/bookmark
const removeBookmark = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const bookmark = await Bookmark.findOneAndDelete({ user: req.user.id, post: postId });

        if (!bookmark) {
            return res.status(404).json({ success: false, message: "Bookmark not found" });
        }

        return res.status(200).json({ success: true, message: "Bookmark removed" });
    } catch (e) {
        console.error("removeBookmark error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/bookmarks — User's own bookmarks
const getBookmarks = async (req, res) => {
    try {
        const parsedPage = Number.parseInt(req.query.page, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(50, parsedLimit)
            : 10;
        const skip = (pageNum - 1) * limitNum;

        const [bookmarks, total] = await Promise.all([
            Bookmark.find({ user: req.user.id })
                .populate({
                    path: "post",
                    match: { status: "published" },
                    populate: [
                        { path: "author", select: "username profileImage" },
                        { path: "category", select: "name slug" }
                    ]
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Bookmark.countDocuments({ user: req.user.id })
        ]);

        const visibleBookmarks = bookmarks.filter((bookmark) => bookmark.post);

        return res.status(200).json({
            success: true,
            message: "Bookmarks fetched",
            data: {
                bookmarks: visibleBookmarks,
                pagination: {
                    total: visibleBookmarks.length,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(visibleBookmarks.length / limitNum)
                }
            }
        });
    } catch (e) {
        console.error("getBookmarks error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { getBookmarkStatus, addBookmark, removeBookmark, getBookmarks };
