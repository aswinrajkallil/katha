import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import Report from "../models/Report.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import { handle } from "../utils/httpError.js";
import { parseDateRange, fillDailySeries, dailyGroup } from "../utils/dateRange.js";
import { buildAuditScope } from "../services/auditService.js";

// Per-day counts of documents created inside the window, zero-filled so charts have no gaps.
const dailyCounts = async (Model, range, { match = {}, withDeleted = false, key = "count" } = {}) => {
    const pipeline = Model.aggregate([
        { $match: { ...match, createdAt: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: dailyGroup("$createdAt"), [key]: { $sum: 1 } } }
    ]);
    if (withDeleted) pipeline.option({ withDeleted: true });
    return pipeline;
};

const MODERATION_ACTION_PREFIXES = /^(post|comment|user|report)\./;

// Shared by the dashboard (charts) and the analytics page (everything).
const buildTrends = async (range, actor) => {
    const [signups, posts, likes, comments, moderation] = await Promise.all([
        // Registrations include accounts that were deactivated later
        dailyCounts(User, range, { withDeleted: true }),
        dailyCounts(Post, range, { withDeleted: true, match: { status: "published" } }),
        dailyCounts(Like, range),
        dailyCounts(Comment, range, { match: { isDeleted: false } }),
        AdminAuditLog.aggregate([
            { $match: { $and: [buildAuditScope(actor), { createdAt: { $gte: range.from, $lte: range.to }, action: MODERATION_ACTION_PREFIXES }] } },
            { $group: { _id: dailyGroup("$createdAt"), count: { $sum: 1 } } }
        ])
    ]);

    const likeSeries = fillDailySeries(range, likes, ["count"]);
    const commentSeries = fillDailySeries(range, comments, ["count"]);

    return {
        registrations: fillDailySeries(range, signups, ["count"]),
        posts: fillDailySeries(range, posts, ["count"]),
        engagement: likeSeries.map((point, i) => ({
            date: point.date,
            likes: point.count,
            comments: commentSeries[i].count
        })),
        moderation: fillDailySeries(range, moderation, ["count"])
    };
};

const rangeInfo = (range) => ({ key: range.key, from: range.from, to: range.to, days: range.days });

// GET /api/admin/trends?range=  — the four dashboard charts
export const getDashboardTrends = handle(async (req, res) => {
    const range = parseDateRange(req.query);
    return res.json({ success: true, data: { range: rangeInfo(range), ...(await buildTrends(range, req.actor)) } });
}, "Unable to load trends");

// GET /api/admin/analytics?range=
export const getAnalytics = handle(async (req, res) => {
    const range = parseDateRange(req.query);
    const inRange = { createdAt: { $gte: range.from, $lte: range.to } };

    const [
        trends,
        activeUsers,
        deletedUsers,
        publishedPosts,
        draftPosts,
        popularPosts,
        activeAuthors,
        popularCategories,
        reportsByReason,
        reportsByStatus,
        resolutionTimes,
        reportsInRange
    ] = await Promise.all([
        buildTrends(range, req.actor),
        User.countDocuments(),
        User.countDocuments({ isDeleted: true }),
        Post.countDocuments({ status: "published" }),
        Post.countDocuments({ status: "draft" }),
        // Posts ranked by likes + comments earned inside the window
        Like.aggregate([
            { $match: inRange },
            { $group: { _id: "$post", likes: { $sum: 1 } } },
            {
                $lookup: {
                    from: "comments",
                    let: { postId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$post", "$$postId"] }, isDeleted: false, createdAt: { $gte: range.from, $lte: range.to } } },
                        { $count: "n" }
                    ],
                    as: "c"
                }
            },
            { $addFields: { comments: { $ifNull: [{ $arrayElemAt: ["$c.n", 0] }, 0] } } },
            { $addFields: { score: { $add: ["$likes", "$comments"] } } },
            { $sort: { score: -1, _id: 1 } },
            { $limit: 50 },
            { $lookup: { from: "posts", localField: "_id", foreignField: "_id", as: "post" } },
            { $unwind: "$post" },
            { $match: { "post.isDeleted": { $ne: true }, "post.status": "published" } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "post.author", foreignField: "_id", as: "author" } },
            {
                $project: {
                    _id: 1,
                    title: "$post.title",
                    slug: "$post.slug",
                    likes: 1,
                    comments: 1,
                    author: { $arrayElemAt: ["$author.username", 0] }
                }
            }
        ]),
        Post.aggregate([
            { $match: { status: "published", ...inRange } },
            { $group: { _id: "$author", posts: { $sum: 1 } } },
            { $sort: { posts: -1, _id: 1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $match: { "user.isDeleted": { $ne: true } } },
            { $project: { _id: 1, posts: 1, username: "$user.username", fullName: "$user.fullName", profileImage: "$user.profileImage" } }
        ]),
        Post.aggregate([
            { $match: { status: "published", category: { $ne: null } } },
            { $group: { _id: "$category", posts: { $sum: 1 } } },
            { $sort: { posts: -1, _id: 1 } },
            { $limit: 10 },
            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { _id: 1, posts: 1, name: "$category.name" } }
        ]),
        Report.aggregate([
            { $match: inRange },
            { $group: { _id: "$reason", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        Report.aggregate([{ $match: inRange }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Report.aggregate([
            { $match: { status: { $in: ["resolved", "dismissed"] }, resolvedAt: { $ne: null }, ...inRange } },
            { $group: { _id: null, avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } }, count: { $sum: 1 } } }
        ]),
        Report.countDocuments(inRange)
    ]);

    const byStatus = Object.fromEntries(reportsByStatus.map((r) => [r._id, r.count]));
    const closed = (byStatus.resolved || 0) + (byStatus.dismissed || 0);
    const rate = (n) => (reportsInRange > 0 ? Math.round((n / reportsInRange) * 1000) / 10 : null);

    return res.json({
        success: true,
        data: {
            range: rangeInfo(range),
            trends,
            accounts: { active: activeUsers, deleted: deletedUsers },
            content: { published: publishedPosts, draft: draftPosts },
            popularPosts,
            activeAuthors,
            popularCategories,
            reportsByReason: reportsByReason.map((r) => ({ reason: r._id, count: r.count })),
            moderation: {
                reportsReceived: reportsInRange,
                resolved: byStatus.resolved || 0,
                dismissed: byStatus.dismissed || 0,
                open: (byStatus.pending || 0) + (byStatus.under_review || 0),
                resolutionRate: rate(closed),
                avgResolutionHours: resolutionTimes[0] ? Math.round((resolutionTimes[0].avgMs / 3600000) * 10) / 10 : null
            }
        }
    });
}, "Unable to load analytics");
