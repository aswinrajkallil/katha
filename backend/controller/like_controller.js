import Like from "../models/Like.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

const isValidId = id => mongoose.Types.ObjectId.isValid(id);

const likePost = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!isValidId(postId)) return res.status(400).json({ success: false, message: "Invalid post ID" });
        const post = await Post.findById(postId).select("author status");
        if (!post || post.status !== "published") return res.status(404).json({ success: false, message: "Post not found" });
        try { await Like.create({ user: req.user.id, post: postId }); }
        catch (error) {
            if (error.code === 11000) return res.status(409).json({ success: false, message: "Already liked" });
            throw error;
        }
        if (post.author.toString() !== req.user.id) {
            await Notification.create({ recipient: post.author, sender: req.user.id, type: "LIKE", post: postId });
        }
        const likes = await Like.countDocuments({ post: postId });
        return res.status(201).json({ success: true, message: "Post liked", data: { likes } });
    } catch (error) {
        console.error("likePost:", error);
        return res.status(500).json({ success: false, message: "Unable to like post" });
    }
};

const unlikePost = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!isValidId(postId)) return res.status(400).json({ success: false, message: "Invalid post ID" });
        const deleted = await Like.findOneAndDelete({ user: req.user.id, post: postId });
        if (!deleted) return res.status(404).json({ success: false, message: "You haven't liked this post" });
        const likes = await Like.countDocuments({ post: postId });
        return res.json({ success: true, message: "Post unliked", data: { likes } });
    } catch (error) {
        console.error("unlikePost:", error);
        return res.status(500).json({ success: false, message: "Unable to unlike post" });
    }
};

const getLikes = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!isValidId(postId)) return res.status(400).json({ success: false, message: "Invalid post ID" });
        const count = await Like.countDocuments({ post: postId });
        const userLiked = req.user ? Boolean(await Like.exists({ user: req.user.id, post: postId })) : false;
        return res.json({ success: true, message: "Likes fetched", data: { likes: count, userLiked } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to fetch likes" });
    }
};

export { likePost, unlikePost, getLikes };
