import Post from "../models/Post.js";

// GET /api/posts/featured?limit= — public, read-only.
// Only ever returns posts that are featured AND published AND not deleted (the Post model hides
// soft-deleted posts by default), so unpublished or removed posts can never leak through here.
export const getFeaturedPosts = async (req, res) => {
    try {
        const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
        const posts = await Post.find({ isFeatured: true, status: "published" })
            .populate("author", "username fullName profileImage")
            .populate("category", "name slug")
            .select("title slug excerpt type coverImage videoThumbnail author category tags views createdAt featuredOrder featuredAt")
            .sort({ featuredOrder: 1, featuredAt: -1 })
            .limit(limit)
            .lean();

        return res.json({ success: true, message: "Featured posts fetched", data: posts });
    } catch (error) {
        console.error("getFeaturedPosts:", error);
        return res.status(500).json({ success: false, message: "Unable to load featured posts" });
    }
};
