import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
import { emitToRoom } from "../socket.js";
import { isAdminRole, isStaffRole } from "../utils/permissions.js";
import { recordAudit, AUDIT_ACTIONS } from "../services/auditService.js";
import { removeComment } from "../services/moderationService.js";
import { HttpError } from "../utils/httpError.js";

const isValidId = id => mongoose.Types.ObjectId.isValid(id);

const createComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parentComment } = req.body;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }
        if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Comment must be between 1 and 2000 characters" });
        }

        const post = await Post.findById(postId).select("status author");
        if (!post || post.status !== "published") {
            return res.status(404).json({ success: false, message: "Post not found or not published" });
        }

        const commentData = {
            post: postId,
            author: req.user.id,
            content: content.trim()
        };

        if (parentComment) {
            if (!isValidId(parentComment)) {
                return res.status(400).json({ success: false, message: "Invalid parent comment ID" });
            }
            // Allow replying to ANY valid comment on this post for unlimited tree depth
            const parent = await Comment.findOne({ _id: parentComment, post: postId }).select("_id author");
            if (!parent) {
                return res.status(400).json({ success: false, message: "Parent comment not found on this post" });
            }
            commentData.parentComment = parent._id;
        }

        const comment = await Comment.create(commentData);
        await comment.populate("author", "username fullName profileImage");

        const recipient = parentComment
            ? (await Comment.findById(parentComment).select("author"))?.author
            : post.author;

        if (recipient && recipient.toString() !== req.user.id) {
            await Notification.create({
                recipient,
                sender: req.user.id,
                type: "COMMENT",
                post: postId,
                comment: comment._id
            }).catch(error => console.error("Comment notification failed:", error));
            emitToRoom(`user:${recipient}`, "notification:new", {
                type: "COMMENT",
                postId,
                commentId: comment._id,
                actorId: req.user.id
            });
        }

        const formatted = {
            ...comment.toObject(),
            likesCount: 0,
            likedByMe: false,
            isEdited: false,
            isDeleted: false
        };

        const commentsCount = await Comment.countDocuments({ post: postId, isDeleted: false });
        emitToRoom(`post:${postId}`, "comment:created", {
            postId,
            commentsCount,
            comment: formatted,
            actorId: req.user.id
        });

        return res.status(201).json({ success: true, message: "Comment added", data: formatted });
    } catch (error) {
        console.error("createComment:", error);
        return res.status(500).json({ success: false, message: "Unable to add comment" });
    }
};

const getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const { sort = "best" } = req.query;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        // Fetch all comments for this post
        const comments = await Comment.find({ post: postId })
            .populate("author", "username fullName profileImage")
            .lean();

        const currentUserId = req.user?.id ? req.user.id.toString() : null;

        // Moderation metadata (who removed it and why) is staff-only
        const stripModeration = ({ deletedBy, deletedAt, moderationReason, ...rest }) => rest;

        // Format comments
        const formatted = comments.map(raw => {
            const comment = stripModeration(raw);
            const likesArr = Array.isArray(comment.likes) ? comment.likes : [];
            const likesCount = likesArr.length;
            const likedByMe = currentUserId ? likesArr.some(id => id.toString() === currentUserId) : false;

            if (comment.isDeleted) {
                return {
                    ...comment,
                    content: "[deleted]",
                    author: {
                        _id: null,
                        username: "[deleted]",
                        fullName: "[deleted]",
                        profileImage: null
                    },
                    likesCount: 0,
                    likedByMe: false,
                    isDeleted: true
                };
            }

            return {
                ...comment,
                likesCount,
                likedByMe,
                isEdited: Boolean(comment.isEdited),
                isDeleted: false
            };
        });

        // Sort comments: Best (likes desc, then date desc), New (date desc), Old (date asc)
        if (sort === "new") {
            formatted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === "old") {
            formatted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else {
            // "best" is default
            formatted.sort((a, b) => {
                if (b.likesCount !== a.likesCount) {
                    return b.likesCount - a.likesCount;
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        }

        return res.json({
            success: true,
            message: "Comments fetched",
            data: formatted,
            totalCount: formatted.length
        });
    } catch (error) {
        console.error("getComments:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch comments" });
    }
};

const updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }
        if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Comment must be between 1 and 2000 characters" });
        }

        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        if (comment.isDeleted) {
            return res.status(400).json({ success: false, message: "Cannot edit a deleted comment" });
        }

        const isAuthor = comment.author.toString() === req.user.id;
        if (!isAuthor && !isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        const previousContent = comment.content;
        comment.content = content.trim();
        comment.isEdited = true;
        await comment.save();
        if (!isAuthor) {
            // An administrator changed someone else's words: keep the original on record
            await recordAudit(req.actor, {
                action: AUDIT_ACTIONS.COMMENT_EDIT,
                targetType: "comment",
                targetId: comment._id,
                targetLabel: previousContent.slice(0, 120),
                metadata: { postId: comment.post, authorId: comment.author, before: previousContent, after: comment.content }
            });
        }
        await comment.populate("author", "username fullName profileImage");

        const likesArr = Array.isArray(comment.likes) ? comment.likes : [];
        const formatted = {
            ...comment.toObject(),
            likesCount: likesArr.length,
            likedByMe: likesArr.some(uid => uid.toString() === req.user.id),
            isEdited: true,
            isDeleted: false
        };

        const commentsCount = await Comment.countDocuments({ post: comment.post, isDeleted: false });
        emitToRoom(`post:${comment.post}`, "comment:updated", {
            postId: comment.post.toString(),
            commentsCount,
            comment: formatted,
            actorId: req.user.id
        });

        return res.json({ success: true, message: "Comment updated", data: formatted });
    } catch (error) {
        console.error("updateComment:", error);
        return res.status(500).json({ success: false, message: "Unable to update comment" });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        const isAuthor = comment.author.toString() === req.user.id;
        if (!isAuthor) {
            // Someone else's comment: only staff, and only through the audited moderation path
            // (moderators must give a reason, and can only act on normal users' comments).
            if (!isStaffRole(req.user.role)) {
                return res.status(403).json({ success: false, message: "Not authorized" });
            }
            await removeComment(req.actor, id, { reason: req.body?.reason });
            return res.json({ success: true, message: "Comment removed", softDeleted: true, commentId: id });
        }

        const targetPostId = comment.post.toString();
        // Check if comment has replies
        const hasReplies = await Comment.exists({ parentComment: id });

        if (hasReplies) {
            // Soft delete: keep structure for child replies as Reddit does
            comment.isDeleted = true;
            comment.content = "[deleted]";
            comment.deletedAt = new Date();
            comment.deletedBy = comment.author;
            await comment.save();
        } else {
            // Hard delete
            await Comment.findByIdAndDelete(id);
        }
        // Notifications that point at this comment would link to nothing
        await Notification.deleteMany({ comment: id });

        const commentsCount = await Comment.countDocuments({ post: targetPostId, isDeleted: false });
        emitToRoom(`post:${targetPostId}`, "comment:deleted", {
            postId: targetPostId,
            commentsCount,
            commentId: id,
            softDeleted: Boolean(hasReplies),
            actorId: req.user.id
        });

        return res.json({
            success: true,
            message: "Comment deleted",
            softDeleted: Boolean(hasReplies),
            commentId: id
        });
    } catch (error) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error("deleteComment:", error);
        return res.status(500).json({ success: false, message: "Unable to delete comment" });
    }
};

const toggleLikeComment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid comment ID" });

        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        if (comment.isDeleted) return res.status(400).json({ success: false, message: "Cannot like a deleted comment" });

        const userIdStr = req.user.id;
        const isLiked = (comment.likes || []).some(uid => uid.toString() === userIdStr);

        let update;
        if (isLiked) {
            update = { $pull: { likes: req.user.id } };
        } else {
            update = { $addToSet: { likes: req.user.id } };
        }

        const updatedComment = await Comment.findByIdAndUpdate(id, update, { new: true });
        const likesArr = updatedComment.likes || [];

        return res.json({
            success: true,
            message: isLiked ? "Comment unliked" : "Comment liked",
            data: {
                liked: !isLiked,
                likesCount: likesArr.length
            }
        });
    } catch (error) {
        console.error("toggleLikeComment:", error);
        return res.status(500).json({ success: false, message: "Unable to update comment like" });
    }
};

const likeComment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid comment ID" });

        const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        if (comment.isDeleted) return res.status(400).json({ success: false, message: "Cannot like a deleted comment" });

        const updatedComment = await Comment.findByIdAndUpdate(
            id,
            { $addToSet: { likes: req.user.id } },
            { new: true }
        );

        return res.json({
            success: true,
            message: "Comment liked",
            data: {
                liked: true,
                likesCount: (updatedComment.likes || []).length
            }
        });
    } catch (error) {
        console.error("likeComment:", error);
        return res.status(500).json({ success: false, message: "Unable to like comment" });
    }
};

const unlikeComment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid comment ID" });

        const updatedComment = await Comment.findByIdAndUpdate(
            id,
            { $pull: { likes: req.user.id } },
            { new: true }
        );

        return res.json({
            success: true,
            message: "Comment unliked",
            data: {
                liked: false,
                likesCount: (updatedComment?.likes || []).length
            }
        });
    } catch (error) {
        console.error("unlikeComment:", error);
        return res.status(500).json({ success: false, message: "Unable to unlike comment" });
    }
};

export {
    createComment,
    getComments,
    updateComment,
    deleteComment,
    toggleLikeComment,
    likeComment,
    unlikeComment
};
