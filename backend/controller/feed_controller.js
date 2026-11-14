import Follow from "../models/Follow.js";
import Post from "../models/Post.js";

const getFollowingFeed = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const relations = await Follow.find({ follower: req.user.id }).select("following").lean();
        const authorIds = relations.map(item => item.following);
        const query = { status: "published", author: { $in: authorIds } };
        const [posts, total] = await Promise.all([
            Post.find(query).populate("author", "username fullName profileImage").populate("category", "name slug")
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Post.countDocuments(query)
        ]);
        return res.json({ success: true, data: { posts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
        console.error("getFollowingFeed:", error);
        return res.status(500).json({ success: false, message: "Unable to load your feed" });
    }
};

export { getFollowingFeed };
