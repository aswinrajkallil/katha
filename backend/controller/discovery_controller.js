import User from "../models/User.js";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import Follow from "../models/Follow.js";

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
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
        const since = new Date(Date.now() - days * 86400000);

        // 1. Gather recent activity (last 7 days): Likes and Comments
        const [recentLikes, recentComments] = await Promise.all([
            Like.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]),
            Comment.aggregate([
                { $match: { createdAt: { $gte: since }, isDeleted: { $ne: true } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ])
        ]);

        const scoreMap = new Map();
        recentLikes.forEach(item => {
            const id = item._id.toString();
            scoreMap.set(id, (scoreMap.get(id) || 0) + item.count * 3);
        });
        recentComments.forEach(item => {
            const id = item._id.toString();
            scoreMap.set(id, (scoreMap.get(id) || 0) + item.count * 2);
        });

        // Qualifying post IDs that had actual activity in the last 7 days
        const scoredIds = Array.from(scoreMap.entries())
            .filter(([, score]) => score > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);

        const hadRecentActivity = scoredIds.length > 0;
        let finalPosts = [];

        if (scoredIds.length > 0) {
            const qualifyingPosts = await Post.find({ _id: { $in: scoredIds }, status: "published" })
                .populate("author", "username fullName profileImage")
                .populate("category", "name slug")
                .lean();

            // Sort by score rank
            const scoreIndex = new Map(scoredIds.map((id, idx) => [id, idx]));
            qualifyingPosts.sort((a, b) =>
                (scoreIndex.get(a._id.toString()) ?? 999) - (scoreIndex.get(b._id.toString()) ?? 999)
            );
            finalPosts = qualifyingPosts.slice(0, limit);
        }

        // If fewer than limit posts qualify, fill remaining slots with all-time most popular (views + likes) then latest
        if (finalPosts.length < limit) {
            const existingIds = new Set(finalPosts.map(p => p._id.toString()));
            const remainingCount = limit - finalPosts.length;

            const fallbackPosts = await Post.find({
                status: "published",
                _id: { $nin: Array.from(existingIds) }
            })
                .populate("author", "username fullName profileImage")
                .populate("category", "name slug")
                .sort({ views: -1, createdAt: -1 })
                .limit(remainingCount)
                .lean();

            finalPosts = [...finalPosts, ...fallbackPosts];
        }

        // Attach comment counts to all trending posts
        const postIds = finalPosts.map(p => p._id);
        const commentCounts = await Comment.aggregate([
            { $match: { post: { $in: postIds }, isDeleted: { $ne: true } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]);
        const commentCountMap = new Map(commentCounts.map(c => [c._id.toString(), c.count]));

        const formatted = finalPosts.map((p, idx) => ({
            ...p,
            rank: idx + 1,
            commentsCount: commentCountMap.get(p._id.toString()) || 0
        }));

        return res.json({
            success: true,
            data: {
                posts: formatted,
                isWeekTrending: hadRecentActivity,
                label: hadRecentActivity ? "Trending this week" : "Popular on Kathā",
                periodDays: days
            }
        });
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
            { $sort: { postCount: -1 } },
            { $limit: 12 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "author" } },
            { $unwind: "$author" },
            {
                $project: {
                    postCount: 1,
                    username: "$author.username",
                    fullName: "$author.fullName",
                    profileImage: "$author.profileImage",
                    bio: "$author.bio"
                }
            }
        ]);

        const currentUserId = req.user?.id ? req.user.id.toString() : null;

        // Fetch follower counts and isFollowing for each author
        const authorIds = rows.map(r => r._id);
        const [followerCounts, myFollows] = await Promise.all([
            Follow.aggregate([
                { $match: { following: { $in: authorIds } } },
                { $group: { _id: "$following", count: { $sum: 1 } } }
            ]),
            currentUserId
                ? Follow.find({ follower: currentUserId, following: { $in: authorIds } }).select("following").lean()
                : []
        ]);

        const followerCountMap = new Map(followerCounts.map(f => [f._id.toString(), f.count]));
        const followingSet = new Set(myFollows.map(f => f.following.toString()));

        const formatted = rows.map(author => {
            const idStr = author._id.toString();
            return {
                ...author,
                followersCount: followerCountMap.get(idStr) || 0,
                isFollowing: followingSet.has(idStr),
                isSelf: currentUserId === idStr
            };
        });

        return res.json({ success: true, data: formatted });
    } catch (error) {
        console.error("getPopularAuthors:", error);
        return res.status(500).json({ success: false, message: "Unable to load authors" });
    }
};

export { searchAll, getTrendingPosts, getPopularAuthors };
