import Follow from "../models/Follow.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/users/:userId/follow
const followUser = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        if (userId === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot follow yourself" });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        try {
            await Follow.create({ follower: req.user.id, following: userId });
        } catch (e) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: "Already following this user" });
            }
            throw e;
        }

        return res.status(201).json({ success: true, message: `You are now following ${targetUser.username}` });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/users/:userId/follow
const unfollowUser = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const follow = await Follow.findOneAndDelete({
            follower: req.user.id,
            following: userId
        });

        if (!follow) {
            return res.status(404).json({ success: false, message: "You are not following this user" });
        }

        return res.status(200).json({ success: true, message: "Unfollowed successfully" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/users/:userId/followers
const getFollowers = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const followers = await Follow.find({ following: userId })
            .populate("follower", "username profileImage bio");

        return res.status(200).json({
            success: true,
            message: "Followers fetched",
            data: {
                followers: followers.map((f) => f.follower),
                count: followers.length
            }
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/users/:userId/following
const getFollowing = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const following = await Follow.find({ follower: userId })
            .populate("following", "username profileImage bio");

        return res.status(200).json({
            success: true,
            message: "Following fetched",
            data: {
                following: following.map((f) => f.following),
                count: following.length
            }
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { followUser, unfollowUser, getFollowers, getFollowing };
