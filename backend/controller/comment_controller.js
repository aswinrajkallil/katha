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

        if (typeof content !== "string" || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        if (content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Comment cannot exceed 2000 characters" });
        }

        const post = await Post.findById(postId).select("status");
        if (!post || post.status !== "published") {
            return res.status(404).json({ success: false, message: "Post not found or not published" });
        }

        const commentData = {
            post: postId,
            author: req.user.id,
            content: content.trim()
        };

        if (parentComment !== undefined && parentComment !== null && parentComment !== "") {
            if (!isValidId(parentComment)) {
                return res.status(400).json({ success: false, message: "Invalid parent comment ID" });
            }

            // Replies are intentionally limited to one level. The parent must be
            // a top-level comment belonging to this same post.
            const parent = await Comment.findOne({
                _id: parentComment,
                post: postId,
                parentComment: null
            }).select("_id");

            if (!parent) {
                return res.status(400).json({
                    success: false,
                    message: "Replies must target a top-level comment on this post"
                });
            }

            commentData.parentComment = parent._id;
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

        const comments = await Comment.find({ post: postId, parentComment: null })
            .populate("author", "username profileImage")
            .sort({ createdAt: 1 });

        const commentIds = comments.map((comment) => comment._id);
        const replies = await Comment.find({
            post: postId,
            parentComment: { $in: commentIds }
        })
            .populate("author", "username profileImage")
            .sort({ createdAt: 1 });

        const repliesByParent = new Map();
        for (const reply of replies) {
            const parentId = reply.parentComment.toString();
            if (!repliesByParent.has(parentId)) repliesByParent.set(parentId, []);
            repliesByParent.get(parentId).push(reply);
        }

        const commentsWithReplies = comments.map((comment) => ({
            ...comment.toObject(),
            replies: repliesByParent.get(comment._id.toString()) || []
        }));

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

        if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Content must be between 1 and 2000 characters" });
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
        console.error("updateComment error:", e);
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

        await Comment.deleteMany({ parentComment: id });
        await Comment.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (e) {
        console.error("deleteComment error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { createComment, getComments, updateComment, deleteComment };
