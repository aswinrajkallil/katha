import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import Bookmark from "../models/Bookmark.js";
import Follow from "../models/Follow.js";
import Notification from "../models/Notification.js";
import cloudinary from "../config/cloudinary.js";
import { emitToRoom, emitToAll } from "../socket.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/stats
export const getAdminStats = async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            publishedPosts,
            draftPosts,
            totalComments,
            totalLikes,
            signupsLast7Days,
            postsLast7Days,
            recentSignups
        ] = await Promise.all([
            User.countDocuments(),
            Post.countDocuments({ status: "published" }),
            Post.countDocuments({ status: "draft" }),
            Comment.countDocuments({ isDeleted: false }),
            Like.countDocuments(),
            User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            Post.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            User.find()
                .select("username fullName email role createdAt profileImage")
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        return res.json({
            success: true,
            data: {
                totals: {
                    users: totalUsers,
                    publishedPosts,
                    draftPosts,
                    comments: totalComments,
                    likes: totalLikes
                },
                recentActivity: {
                    signupsLast7Days,
                    postsLast7Days
                },
                recentSignups
            }
        });
    } catch (err) {
        console.error("getAdminStats error:", err);
        return res.status(500).json({ success: false, message: "Unable to load admin stats" });
    }
};

// GET /api/admin/users?search=&page=&limit=
export const getAdminUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

        const filter = {};
        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            filter.$or = [{ username: regex }, { email: regex }, { fullName: regex }];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("username fullName email role createdAt profileImage")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        const userIds = users.map(u => u._id);
        const postCounts = await Post.aggregate([
            { $match: { author: { $in: userIds } } },
            { $group: { _id: "$author", count: { $sum: 1 } } }
        ]);
        const postCountMap = new Map(postCounts.map(item => [item._id.toString(), item.count]));

        const enrichedUsers = users.map(u => ({
            ...u,
            postsCount: postCountMap.get(u._id.toString()) || 0
        }));

        return res.json({
            success: true,
            data: {
                users: enrichedUsers,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error("getAdminUsers error:", err);
        return res.status(500).json({ success: false, message: "Unable to load users" });
    }
};

// GET /api/admin/users/:id
export const getAdminUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = isValidId(id) ? { _id: id } : { username: String(id).toLowerCase() };
        const user = await User.findOne(query).select("-password -refreshToken").lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const userId = user._id;
        const [postsCount, commentsCount, followersCount, followingCount] = await Promise.all([
            Post.countDocuments({ author: userId }),
            Comment.countDocuments({ author: userId, isDeleted: false }),
            Follow.countDocuments({ following: userId }),
            Follow.countDocuments({ follower: userId })
        ]);

        return res.json({
            success: true,
            data: {
                user,
                counts: {
                    posts: postsCount,
                    comments: commentsCount,
                    followers: followersCount,
                    following: followingCount
                }
            }
        });
    } catch (err) {
        console.error("getAdminUserById error:", err);
        return res.status(500).json({ success: false, message: "Unable to load user details" });
    }
};

// GET /api/admin/users/:id/posts?status=&page=
export const getAdminUserPosts = async (req, res) => {
    try {
        const { id } = req.params;
        const queryUser = isValidId(id) ? { _id: id } : { username: String(id).toLowerCase() };
        const user = await User.findOne(queryUser).select("_id");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const status = req.query.status;

        const postFilter = { author: user._id };
        if (status && ["draft", "published"].includes(status)) {
            postFilter.status = status;
        }

        const [posts, total] = await Promise.all([
            Post.find(postFilter)
                .populate("category", "name slug")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Post.countDocuments(postFilter)
        ]);

        const postIds = posts.map(p => p._id);
        const [commentAgg, likeAgg] = await Promise.all([
            Comment.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]),
            Like.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ])
        ]);
        const commentMap = new Map(commentAgg.map(c => [c._id.toString(), c.count]));
        const likeMap = new Map(likeAgg.map(l => [l._id.toString(), l.count]));

        const enrichedPosts = posts.map(p => ({
            ...p,
            views: p.views || 0,
            likesCount: likeMap.get(p._id.toString()) || 0,
            commentsCount: commentMap.get(p._id.toString()) || 0
        }));

        return res.json({
            success: true,
            data: {
                posts: enrichedPosts,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error("getAdminUserPosts error:", err);
        return res.status(500).json({ success: false, message: "Unable to load user posts" });
    }
};

// GET /api/admin/posts?search=&status=&page=
export const getAdminPosts = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const status = req.query.status;

        const filter = {};
        if (status && ["draft", "published"].includes(status)) {
            filter.status = status;
        }
        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            filter.$or = [{ title: regex }, { excerpt: regex }, { tags: regex }];
        }

        const [posts, total] = await Promise.all([
            Post.find(filter)
                .populate("author", "username fullName profileImage email")
                .populate("category", "name slug")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Post.countDocuments(filter)
        ]);

        const postIds = posts.map(p => p._id);
        const [commentAgg, likeAgg] = await Promise.all([
            Comment.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]),
            Like.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ])
        ]);
        const commentMap = new Map(commentAgg.map(c => [c._id.toString(), c.count]));
        const likeMap = new Map(likeAgg.map(l => [l._id.toString(), l.count]));

        const enrichedPosts = posts.map(p => ({
            ...p,
            views: p.views || 0,
            likesCount: likeMap.get(p._id.toString()) || 0,
            commentsCount: commentMap.get(p._id.toString()) || 0
        }));

        return res.json({
            success: true,
            data: {
                posts: enrichedPosts,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error("getAdminPosts error:", err);
        return res.status(500).json({ success: false, message: "Unable to load posts" });
    }
};

// DELETE /api/admin/posts/:id
export const deleteAdminPost = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid post ID" });

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        // Clean up associated data
        await Promise.all([
            Like.deleteMany({ post: id }),
            Bookmark.deleteMany({ post: id }),
            Comment.deleteMany({ post: id }),
            Notification.deleteMany({ post: id })
        ]);

        if (post.coverImagePublicId) {
            try {
                await cloudinary.uploader.destroy(post.coverImagePublicId, { resource_type: "image" });
            } catch (err) {
                console.error("Cloudinary destroy post image failed:", err);
            }
        }

        await Post.findByIdAndDelete(id);

        // Broadcast realtime post:deleted so open feeds immediately remove it
        emitToAll("post:deleted", { postId: id });
        emitToRoom(`post:${id}`, "post:deleted", { postId: id });

        return res.json({ success: true, message: "Post deleted by admin" });
    } catch (err) {
        console.error("deleteAdminPost error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete post" });
    }
};

// DELETE /api/admin/users/:id
export const deleteAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });

        if (id === req.user.id || id === req.user._id) {
            return res.status(400).json({ success: false, message: "Cannot delete your own admin account" });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

        if (targetUser.role === "admin") {
            return res.status(403).json({ success: false, message: "Cannot delete another admin account" });
        }

        // 1. Destroy each of the user's post cover images from Cloudinary and delete their posts
        const userPosts = await Post.find({ author: id }).select("_id coverImagePublicId");
        const postIds = userPosts.map(p => p._id);

        for (const p of userPosts) {
            if (p.coverImagePublicId) {
                try {
                    await cloudinary.uploader.destroy(p.coverImagePublicId, { resource_type: "image" });
                } catch (err) {
                    console.error(`Cloudinary destroy cover failed for post ${p._id}:`, err);
                }
            }
        }

        await Post.deleteMany({ author: id });

        // 2. Delete likes, bookmarks, comments, and notifications on those posts
        if (postIds.length > 0) {
            await Promise.all([
                Like.deleteMany({ post: { $in: postIds } }),
                Bookmark.deleteMany({ post: { $in: postIds } }),
                Comment.deleteMany({ post: { $in: postIds } }),
                Notification.deleteMany({ post: { $in: postIds } })
            ]);
        }

        // 3. Delete the user's likes, bookmarks, and follows (both directions)
        await Promise.all([
            Like.deleteMany({ user: id }),
            Bookmark.deleteMany({ user: id }),
            Follow.deleteMany({ $or: [{ follower: id }, { following: id }] })
        ]);

        // 4. $pull the user id from Comment.likes everywhere
        await Comment.updateMany({ likes: id }, { $pull: { likes: id } });

        // 5. For the user's comments: delete those with no replies; for ones with replies mark isDeleted and clear content so threads stay intact
        const userComments = await Comment.find({ author: id }).select("_id");
        for (const comm of userComments) {
            const hasReplies = await Comment.exists({ parentComment: comm._id });
            if (hasReplies) {
                await Comment.findByIdAndUpdate(comm._id, {
                    isDeleted: true,
                    content: "[deleted]"
                });
            } else {
                await Comment.findByIdAndDelete(comm._id);
            }
        }

        // 6. Delete notifications where they are sender or recipient
        await Notification.deleteMany({ $or: [{ sender: id }, { recipient: id }] });

        // 7. Destroy profileImagePublicId and coverImagePublicId from Cloudinary
        if (targetUser.profileImagePublicId) {
            try {
                await cloudinary.uploader.destroy(targetUser.profileImagePublicId, { resource_type: "image" });
            } catch (err) {
                console.error("Cloudinary destroy avatar failed:", err);
            }
        }
        if (targetUser.coverImagePublicId) {
            try {
                await cloudinary.uploader.destroy(targetUser.coverImagePublicId, { resource_type: "image" });
            } catch (err) {
                console.error("Cloudinary destroy cover failed:", err);
            }
        }

        // 8. Finally delete the user document
        await User.findByIdAndDelete(id);

        // Broadcast realtime events so deleted posts disappear from open feeds
        for (const p of userPosts) {
            emitToAll("post:deleted", { postId: p._id.toString() });
        }

        return res.json({
            success: true,
            message: `User @${targetUser.username} and all associated data deleted successfully`
        });
    } catch (err) {
        console.error("deleteAdminUser error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
};
