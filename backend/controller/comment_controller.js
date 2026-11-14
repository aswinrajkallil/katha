import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/posts/:postId/comments
const createComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parentComment } = req.body;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const post = await Post.findById(postId);
        if (!post || post.status !== "published") {
            return res.status(404).json({ success: false, message: "Post not found or not published" });
        }

        const commentData = {
            post: postId,
            author: req.user.id,
            content: content.trim()
        };

        if (parentComment && isValidId(parentComment)) {
            const parent = await Comment.findById(parentComment);
            if (parent) commentData.parentComment = parentComment;
        }

        const comment = await Comment.create(commentData);
        await comment.populate("author", "username profileImage");

        return res.status(201).json({
            success: true,
            message: "Comment added",
            data: comment
        });
    } catch (e) {
        console.error("createComment error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/:postId/comments
const getComments = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        // Get top-level comments (parentComment is null)
        const comments = await Comment.find({ post: postId, parentComment: null })
            .populate("author", "username profileImage")
            .sort({ createdAt: 1 });

        // Get replies for each comment
        const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
                const replies = await Comment.find({ parentComment: comment._id })
                    .populate("author", "username profileImage")
                    .sort({ createdAt: 1 });
                return { ...comment.toObject(), replies };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Comments fetched",
            data: commentsWithReplies
        });
    } catch (e) {
        console.error("getComments error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PUT /api/comments/:id
const updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }

        const comment = await Comment.findById(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const isAuthor = comment.author.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        comment.content = content.trim();
        await comment.save();
        await comment.populate("author", "username profileImage");

        return res.status(200).json({
            success: true,
            message: "Comment updated",
            data: comment
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/comments/:id
const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        const comment = await Comment.findById(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const isAuthor = comment.author.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // Also delete replies to this comment
        await Comment.deleteMany({ parentComment: id });
        await Comment.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { createComment, getComments, updateComment, deleteComment };
