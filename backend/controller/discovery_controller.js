import User from "../models/User.js";
import Post from "../models/Post.js";
import Like from "../models/Like.js";

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchAll = async (req, res) => {
    try {
        const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
        if (q.length < 2) return res.status(400).json({ success: false, message: "Search must contain at least 2 characters" });
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const regex = new RegExp(escapeRegex(q), "i");
        const [users, posts, userCount, postCount] = await Promise.all([
            User.find({ $or: [{ username: regex }, { fullName: regex }] }).select("username fullName profileImage bio").limit(limit).lean(),
            Post.find({ status: "published", $or: [{ title: regex }, { excerpt: regex }, { content: regex }, { tags: regex }] })
                .populate("author", "username fullName profileImage").populate("category", "name slug")
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            User.countDocuments({ $or: [{ username: regex }, { fullName: regex }] }),
            Post.countDocuments({ status: "published", $or: [{ title: regex }, { excerpt: regex }, { content: regex }, { tags: regex }] })
        ]);
        return res.json({ success: true, data: { users, posts, pagination: { users: { total: userCount }, posts: { total: postCount, page, limit, totalPages: Math.ceil(postCount / limit) } } } });
    } catch (error) {
        console.error("searchAll:", error);
        return res.status(500).json({ success: false, message: "Search failed" });
    }
};

const getTrendingPosts = async (req, res) => {
    try {
        const days = Math.min(30, Math.max(1, Number.parseInt(req.query.days, 10) || 7));
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const since = new Date(Date.now() - days * 86400000);
        const ranked = await Like.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: "$post", likes: { $sum: 1 } } },
            { $sort: { likes: -1 } }, { $limit: limit }
        ]);
        const ids = ranked.map(item => item._id);
        const posts = await Post.find({ _id: { $in: ids }, status: "published" })
            .populate("author", "username fullName profileImage").populate("category", "name slug").lean();
        const order = new Map(ranked.map((item, index) => [item._id.toString(), index]));
        posts.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));
        return res.json({ success: true, data: { posts, periodDays: days } });
    } catch (error) {
        console.error("getTrendingPosts:", error);
        return res.status(500).json({ success: false, message: "Unable to load trending posts" });
    }
};

const getPopularAuthors = async (req, res) => {
    try {
        const rows = await Post.aggregate([
            { $match: { status: "published" } },
            { $group: { _id: "$author", postCount: { $sum: 1 } } },
            { $sort: { postCount: -1 } }, { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "author" } },
            { $unwind: "$author" },
            { $project: { postCount: 1, username: "$author.username", fullName: "$author.fullName", profileImage: "$author.profileImage", bio: "$author.bio" } }
        ]);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error("getPopularAuthors:", error);
        return res.status(500).json({ success: false, message: "Unable to load authors" });
    }
};

export { searchAll, getTrendingPosts, getPopularAuthors };
