import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

const getFollowingFeed = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const sort = req.query.sort || "latest";
        const hasVideo = req.query.hasVideo === "true";
        const authorFilter = req.query.author;

        // Fetch user's follows with populated author details
        const relations = await Follow.find({ follower: req.user.id })
            .populate("following", "username fullName profileImage bio")
            .lean();

        const authorObjectIds = relations
            .map(item => item.following?._id)
            .filter(Boolean);

        const authorIds = authorObjectIds.map(id => id.toString());
        const followingCount = authorIds.length;

        // Fetch latest post timestamp for each followed person
        let people = [];
        if (authorObjectIds.length > 0) {
            const latestPosts = await Post.aggregate([
                { $match: { author: { $in: authorObjectIds }, status: "published" } },
                { $group: { _id: "$author", latestPostAt: { $max: "$createdAt" } } }
            ]);
            const latestMap = new Map(latestPosts.map(p => [p._id.toString(), p.latestPostAt]));

            people = relations.map(r => {
                const u = r.following;
                if (!u) return null;
                const idStr = u._id.toString();
                return {
                    _id: u._id,
                    username: u.username,
                    fullName: u.fullName,
                    profileImage: u.profileImage,
                    bio: u.bio,
                    latestPostAt: latestMap.get(idStr) || null
                };
            }).filter(Boolean);
        }

        // If not following anyone, return early with 0 count
        if (authorIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    posts: [],
                    people: [],
                    followingCount: 0,
                    pagination: { total: 0, page, limit, totalPages: 0 }
                }
            });
        }

        // Build query
        const query = { status: "published" };
        if (authorFilter && authorIds.includes(authorFilter)) {
            query.author = authorFilter;
        } else {
            query.author = { $in: authorObjectIds };
        }

        if (hasVideo) {
            query.videoUrl = { $exists: true, $ne: "" };
        }

        // Determine sort order
        let sortOption = { createdAt: -1, _id: -1 };
        if (sort === "views" || sort === "mostViewed") {
            sortOption = { views: -1, createdAt: -1, _id: -1 };
        }

        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate("author", "username fullName profileImage")
                .populate("category", "name slug")
                .sort(sortOption)
                .skip((page - 1) * limit)
                .limit(limit),
            Post.countDocuments(query)
        ]);

        const postIds = posts.map(p => p._id);
        const counts = await Comment.aggregate([
            { $match: { post: { $in: postIds }, isDeleted: { $ne: true } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));

        const postsWithCounts = posts.map(p => ({
            ...p.toObject(),
            commentsCount: countMap.get(p._id.toString()) || 0
        }));

        if (sort === "comments" || sort === "mostCommented") {
            postsWithCounts.sort((a, b) => {
                const diff = (b.commentsCount || 0) - (a.commentsCount || 0);
                if (diff !== 0) return diff;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        }

        return res.json({
            success: true,
            data: {
                posts: postsWithCounts,
                people,
                followingCount,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        console.error("getFollowingFeed:", error);
        return res.status(500).json({ success: false, message: "Unable to load your feed" });
    }
};

export { getFollowingFeed };
