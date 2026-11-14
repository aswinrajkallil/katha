import Follow from "../models/Follow.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const followUser = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
        if (userId === req.user.id) return res.status(400).json({ success: false, message: "You cannot follow yourself" });
        const target = await User.findById(userId).select("_id username");
        if (!target) return res.status(404).json({ success: false, message: "User not found" });
        try {
            await Follow.create({ follower: req.user.id, following: userId });
        } catch (error) {
            if (error.code === 11000) return res.status(409).json({ success: false, message: "Already following this user" });
            throw error;
        }
        await Notification.create({ recipient: userId, sender: req.user.id, type: "FOLLOW" });
        const followers = await Follow.countDocuments({ following: userId });
        return res.status(201).json({ success: true, message: `You are now following ${target.username}`, data: { followers } });
    } catch (error) {
        console.error("followUser:", error);
        return res.status(500).json({ success: false, message: "Unable to follow user" });
    }
};

const unfollowUser = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
        const result = await Follow.findOneAndDelete({ follower: req.user.id, following: userId });
        if (!result) return res.status(404).json({ success: false, message: "You are not following this user" });
        const followers = await Follow.countDocuments({ following: userId });
        return res.json({ success: true, message: "Unfollowed successfully", data: { followers } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to unfollow user" });
    }
};

const listRelations = async (req, res, relation) => {
    const { userId } = req.params;
    if (!isValidId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = relation === "followers" ? { following: userId } : { follower: userId };
    const field = relation === "followers" ? "follower" : "following";
    const [rows, total] = await Promise.all([
        Follow.find(filter).select(field).populate(field, "username fullName profileImage bio").sort({ createdAt: -1 })
            .skip((page - 1) * limit).limit(limit),
        Follow.countDocuments(filter)
    ]);
    return res.json({ success: true, data: { [relation]: rows.map(row => row[field]).filter(Boolean), pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
};

const getFollowers = async (req, res) => {
    try { return await listRelations(req, res, "followers"); }
    catch (error) { console.error("getFollowers:", error); return res.status(500).json({ success: false, message: "Unable to fetch followers" }); }
};
const getFollowing = async (req, res) => {
    try { return await listRelations(req, res, "following"); }
    catch (error) { console.error("getFollowing:", error); return res.status(500).json({ success: false, message: "Unable to fetch following" }); }
};
const getFollowStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidId(userId)) return res.status(400).json({ success: false, message: "Invalid user ID" });
        const following = await Follow.exists({ follower: req.user.id, following: userId });
        return res.json({ success: true, data: { isFollowing: Boolean(following) } });
    } catch (error) { return res.status(500).json({ success: false, message: "Unable to check follow status" }); }
};

export { followUser, unfollowUser, getFollowers, getFollowing, getFollowStatus };
