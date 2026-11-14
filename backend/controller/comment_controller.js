import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

const isValidId = id => mongoose.Types.ObjectId.isValid(id);

const createComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parentComment } = req.body;
        if (!isValidId(postId)) return res.status(400).json({ success: false, message: "Invalid post ID" });
        if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Comment must be between 1 and 2000 characters" });
        }
        const post = await Post.findById(postId).select("status author");
        if (!post || post.status !== "published") return res.status(404).json({ success: false, message: "Post not found or not published" });
        const commentData = { post: postId, author: req.user.id, content: content.trim() };
        if (parentComment) {
            if (!isValidId(parentComment)) return res.status(400).json({ success: false, message: "Invalid parent comment ID" });
            const parent = await Comment.findOne({ _id: parentComment, post: postId, parentComment: null }).select("_id author");
            if (!parent) return res.status(400).json({ success: false, message: "Replies must target a top-level comment on this post" });
            commentData.parentComment = parent._id;
        }
        const comment = await Comment.create(commentData);
        await comment.populate("author", "username fullName profileImage");
        const recipient = parentComment
            ? (await Comment.findById(parentComment).select("author")).author
            : post.author;
        if (recipient && recipient.toString() !== req.user.id) {
            await Notification.create({ recipient, sender: req.user.id, type: "COMMENT", post: postId, comment: comment._id });
        }
        return res.status(201).json({ success: true, message: "Comment added", data: comment });
    } catch (error) {
        console.error("createComment:", error);
        return res.status(500).json({ success: false, message: "Unable to add comment" });
    }
};

const getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!isValidId(postId)) return res.status(400).json({ success: false, message: "Invalid post ID" });
        const comments = await Comment.find({ post: postId, parentComment: null })
            .populate("author", "username fullName profileImage").sort({ createdAt: 1 });
        const ids = comments.map(comment => comment._id);
        const replies = ids.length ? await Comment.find({ post: postId, parentComment: { $in: ids } })
            .populate("author", "username fullName profileImage").sort({ createdAt: 1 }) : [];
        const grouped = new Map();
        for (const reply of replies) {
            const key = reply.parentComment.toString();
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(reply);
        }
        return res.json({ success: true, message: "Comments fetched", data: comments.map(comment => ({
            ...comment.toObject(), replies: grouped.get(comment._id.toString()) || []
        })) });
    } catch (error) {
        console.error("getComments:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch comments" });
    }
};

const updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid comment ID" });
        if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Comment must be between 1 and 2000 characters" });
        }
        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        if (comment.author.toString() !== req.user.id && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Not authorized" });
        comment.content = content.trim();
        await comment.save();
        await comment.populate("author", "username fullName profileImage");
        return res.json({ success: true, message: "Comment updated", data: comment });
    } catch (error) {
        console.error("updateComment:", error);
        return res.status(500).json({ success: false, message: "Unable to update comment" });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid comment ID" });
        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        if (comment.author.toString() !== req.user.id && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Not authorized" });
        await Comment.deleteMany({ parentComment: id });
        await Comment.findByIdAndDelete(id);
        return res.json({ success: true, message: "Comment deleted" });
    } catch (error) {
        console.error("deleteComment:", error);
        return res.status(500).json({ success: false, message: "Unable to delete comment" });
    }
};

export { createComment, getComments, updateComment, deleteComment };
