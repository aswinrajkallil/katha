import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

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

        const postIds = posts.map(p => p._id);
        const counts = await Comment.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
        const postsWithCounts = posts.map(p => ({
            ...p.toObject(),
            commentsCount: countMap.get(p._id.toString()) || 0
        }));

        return res.json({ success: true, data: { posts: postsWithCounts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
        console.error("getFollowingFeed:", error);
        return res.status(500).json({ success: false, message: "Unable to load your feed" });
    }
};

export { getFollowingFeed };
