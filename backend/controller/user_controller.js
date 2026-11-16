import User from "../models/User.js";
import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import cloudinary from "../config/cloudinary.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const publicFields = "username fullName profileImage coverImage bio location website createdAt";

const getUserProfile = async (req, res) => {
    try {
        const key = req.params.id || req.user?.id;
        if (!key) return res.status(400).json({ success: false, message: "Username or user ID is required" });
        const query = isValidId(key) ? { _id: key } : { username: String(key).toLowerCase() };
        const user = await User.findOne(query).select(publicFields).lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const [followers, following, posts, isFollowing] = await Promise.all([
            Follow.countDocuments({ following: user._id }),
            Follow.countDocuments({ follower: user._id }),
            Post.countDocuments({ author: user._id, status: "published" }),
            req.user?.id && req.user.id !== user._id.toString()
                ? Follow.exists({ follower: req.user.id, following: user._id }) : false
        ]);

        return res.status(200).json({
            success: true, message: "User profile fetched",
            data: { ...user, stats: { followers, following, posts }, isFollowing: Boolean(isFollowing),
                isOwnProfile: req.user?.id === user._id.toString() }
        });
    } catch (error) {
        console.error("getUserProfile:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch profile" });
    }
};

const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -refreshToken");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        return res.json({ success: true, data: user });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to fetch profile" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const allowed = ["fullName", "bio", "location", "website"];
        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] !== "string") {
                    return res.status(400).json({ success: false, message: `${field} must be text` });
                }
                user[field] = req.body[field].trim();
            }
        }

        // Align username rules with register and check-username: lowercase letters, numbers, underscores, dots; 3-30
        if (req.body.username !== undefined) {
            if (typeof req.body.username !== "string") {
                return res.status(400).json({ success: false, message: "Username must be text" });
            }
            const normalized = req.body.username.trim().toLowerCase();
            if (!/^[a-z0-9_.]{3,30}$/.test(normalized)) {
                return res.status(400).json({
                    success: false,
                    message: "Username must be 3–30 characters using lowercase letters, numbers, underscores or dots"
                });
            }
            if (normalized !== user.username) {
                const existing = await User.findOne({ username: normalized, _id: { $ne: user._id } }).select("_id");
                if (existing) {
                    return res.status(409).json({ success: false, message: "That username is already taken" });
                }
                user.username = normalized;
            }
        }

        if (typeof user.bio === "string" && user.bio.length > 300) {
            return res.status(400).json({ success: false, message: "Bio cannot exceed 300 characters" });
        }
        if (user.website && !/^https?:\/\//i.test(user.website)) {
            return res.status(400).json({ success: false, message: "Website must start with http:// or https://" });
        }

        // Extract files from upload.fields or backward-compatible upload.single
        const profileImageFile = req.files?.profileImage?.[0] || (req.file?.fieldname === "profileImage" ? req.file : null);
        const coverImageFile = req.files?.coverImage?.[0] || (req.file?.fieldname === "coverImage" ? req.file : null);

        // Handle profile image removal
        const removeProfile = req.body.removeProfileImage === "true" || req.body.removeProfileImage === true || req.body.removeProfileImage === "1";
        if (removeProfile) {
            if (user.profileImagePublicId) {
                try {
                    await cloudinary.uploader.destroy(user.profileImagePublicId);
                } catch (err) {
                    console.error("Failed to destroy removed profile image:", err);
                }
            }
            user.profileImage = null;
            user.profileImagePublicId = null;
        } else if (profileImageFile) {
            const previousPublicId = user.profileImagePublicId;
            const uploaded = await uploadToCloudinary(profileImageFile.buffer, "katha/profiles");
            user.profileImage = uploaded.url;
            user.profileImagePublicId = uploaded.publicId;

            if (previousPublicId && previousPublicId !== uploaded.publicId) {
                try {
                    await cloudinary.uploader.destroy(previousPublicId);
                } catch (err) {
                    console.error("Failed to destroy previous profile image:", err);
                }
            }
        }

        // Handle cover image removal
        const removeCover = req.body.removeCoverImage === "true" || req.body.removeCoverImage === true || req.body.removeCoverImage === "1";
        if (removeCover) {
            if (user.coverImagePublicId) {
                try {
                    await cloudinary.uploader.destroy(user.coverImagePublicId);
                } catch (err) {
                    console.error("Failed to destroy removed cover image:", err);
                }
            }
            user.coverImage = null;
            user.coverImagePublicId = null;
        } else if (coverImageFile) {
            const previousPublicId = user.coverImagePublicId;
            const uploaded = await uploadToCloudinary(coverImageFile.buffer, "katha/covers");
            user.coverImage = uploaded.url;
            user.coverImagePublicId = uploaded.publicId;

            if (previousPublicId && previousPublicId !== uploaded.publicId) {
                try {
                    await cloudinary.uploader.destroy(previousPublicId);
                } catch (err) {
                    console.error("Failed to destroy previous cover image:", err);
                }
            }
        }

        await user.save();
        const data = user.toObject();
        delete data.password;
        delete data.refreshToken;
        return res.json({ success: true, message: "Profile updated", data });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "That username is already taken" });
        if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
        console.error("updateProfile:", error);
        const status = error.code === "CLOUDINARY_CONFIG_MISSING" ? 502 : 500;
        return res.status(status).json({ success: false, message: error.message || "Unable to update profile" });
    }
};

const updateCoverImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Cover image is required" });
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const previousPublicId = user.coverImagePublicId;
        const uploaded = await uploadToCloudinary(req.file.buffer, "katha/covers");

        user.coverImage = uploaded.url;
        user.coverImagePublicId = uploaded.publicId;
        await user.save();

        if (previousPublicId && previousPublicId !== uploaded.publicId) {
            try {
                await cloudinary.uploader.destroy(previousPublicId);
            } catch (err) {
                console.error("Failed to destroy previous cover image:", err);
            }
        }

        const data = user.toObject();
        delete data.password;
        delete data.refreshToken;
        return res.json({ success: true, message: "Cover image updated", data });
    } catch (error) {
        console.error("updateCoverImage:", error);
        const status = error.code === "CLOUDINARY_CONFIG_MISSING" ? 502 : 500;
        return res.status(status).json({ success: false, message: error.message || "Unable to update cover image" });
    }
};

const getUserPosts = async (req, res) => {
    try {
        const key = req.params.id;
        const user = await User.findOne(isValidId(key) ? { _id: key } : { username: String(key).toLowerCase() }).select("_id username");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const query = { author: user._id, status: "published" };
        const [posts, total] = await Promise.all([
            Post.find(query).populate("author", "username profileImage").populate("category", "name slug")
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Post.countDocuments(query)
        ]);
        return res.json({ success: true, data: { posts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
        console.error("getUserPosts:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch user posts" });
    }
};

const getSuggestedUsers = async (req, res) => {
    try {
        const follows = await Follow.find({ follower: req.user.id }).select("following").lean();
        const excludeIds = [req.user.id, ...follows.map(f => f.following)];
        const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));

        const users = await User.find({ _id: { $nin: excludeIds } })
            .select("username fullName profileImage bio")
            .limit(limit)
            .lean();

        if (!users.length) {
            return res.json({ success: true, data: [] });
        }

        const userIds = users.map(u => u._id);
        const postCounts = await Post.aggregate([
            { $match: { author: { $in: userIds }, status: "published" } },
            { $group: { _id: "$author", count: { $sum: 1 } } }
        ]);

        const countMap = new Map(postCounts.map(item => [item._id.toString(), item.count]));
        const suggested = users.map(u => ({
            ...u,
            postCount: countMap.get(u._id.toString()) || 0
        }));

        suggested.sort((a, b) => b.postCount - a.postCount);

        return res.json({ success: true, data: suggested });
    } catch (error) {
        console.error("getSuggestedUsers:", error);
        return res.status(500).json({ success: false, message: "Unable to load suggested users" });
    }
};

export { getUserProfile, getMyProfile, updateProfile, updateCoverImage, getUserPosts, getSuggestedUsers };
