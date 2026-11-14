import Like from "../models/Like.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/posts/:postId/like
const likePost = async (req, res) => {
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
            await Like.create({ user: req.user.id, post: postId });
        } catch (e) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: "Already liked" });
            }
            throw e;
        }

        const count = await Like.countDocuments({ post: postId });
        return res.status(201).json({ success: true, message: "Post liked", data: { likes: count } });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/posts/:postId/like
const unlikePost = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const like = await Like.findOneAndDelete({ user: req.user.id, post: postId });

        if (!like) {
            return res.status(404).json({ success: false, message: "You haven't liked this post" });
        }

        const count = await Like.countDocuments({ post: postId });
        return res.status(200).json({ success: true, message: "Post unliked", data: { likes: count } });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/:postId/likes
const getLikes = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!isValidId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const count = await Like.countDocuments({ post: postId });

        // If user is authenticated, check if they liked this post
        let userLiked = false;
        if (req.user) {
            const like = await Like.findOne({ user: req.user.id, post: postId });
            userLiked = !!like;
        }

        return res.status(200).json({
            success: true,
            message: "Likes fetched",
            data: { likes: count, userLiked }
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { likePost, unlikePost, getLikes };
