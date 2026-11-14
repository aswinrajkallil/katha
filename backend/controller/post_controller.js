import mongoose from "mongoose";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import Bookmark from "../models/Bookmark.js";

// Helper: validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/posts — Create a post
const createPost = async (req, res) => {
    try {
        const { title, content, excerpt, type, videoUrl, tags, status, category } =
            req.body;

        if (!title || !type) {
            return res.status(400).json({
                success: false,
                message: "Title and type are required"
            });
        }

        if (!["blog", "video"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Post type must be 'blog' or 'video'"
            });
        }

        if (type === "blog" && !content) {
            return res.status(400).json({
                success: false,
                message: "Content is required for blog posts"
            });
        }

        if (type === "video" && !videoUrl) {
            return res.status(400).json({
                success: false,
                message: "Video URL is required for video posts"
            });
        }

        const postData = {
            title,
            content: content || null,
            excerpt: excerpt || null,
            type,
            videoUrl: videoUrl || null,
            // Normalize tags to an array of strings
            tags: (() => {
                if (!tags) return [];
                if (Array.isArray(tags)) return tags;
                // If a single comma‑separated string
                return tags.split(',').map(t => t.trim()).filter(Boolean);
            })(),
            status: status || "draft",
            author: req.user.id  // Always from token, never from body
        };

        if (category && isValidId(category)) {
            postData.category = category;
        }

        // Handle cover image from file upload
        if (req.file) {
            postData.coverImage = `/uploads/${req.file.filename}`;
        }

        const post = await Post.create(postData);
        await post.populate("author", "username email profileImage");
        await post.populate("category", "name slug");

        return res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: post
        });
    } catch (e) {
        console.error('createPost error details:', e);
        // Handle Mongoose validation errors
        if (e.name === 'ValidationError') {
            const messages = Object.values(e.errors).map(err => err.message).join(', ');
            return res.status(400).json({
                success: false,
                message: messages || e.message
            });
        }
        const errMsg = e.message || 'Something went wrong';
        return res.status(500).json({
            success: false,
            message: errMsg
        });
    }
};

// Escape user input before using it in a MongoDB regular expression.
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPostFilters = async (filters, baseQuery = {}) => {
    const query = { ...baseQuery };
    const { search, category, type, tags, dateRange, sort } = filters;

    if (search && typeof search === "string" && search.trim()) {
        const term = new RegExp(escapeRegex(search.trim().slice(0, 100)), "i");
        const User = mongoose.model("User");
        const Category = mongoose.model("Category");
        const [authors, categories] = await Promise.all([
            User.find({ username: term }).select("_id").lean(),
            Category.find({ name: term }).select("_id").lean()
        ]);
        const searchConditions = [
            { title: term }, { content: term }, { excerpt: term }, { tags: term }
        ];
        if (authors.length) searchConditions.push({ author: { $in: authors.map(user => user._id) } });
        if (categories.length) searchConditions.push({ category: { $in: categories.map(item => item._id) } });
        query.$and = [...(query.$and || []), { $or: searchConditions }];
    }

    if (category) {
        if (isValidId(category)) {
            query.category = category;
        } else {
            const Category = mongoose.model("Category");
            const found = await Category.findOne({ slug: category }).select("_id").lean();
            query.category = found?._id || null;
        }
    }

    if (type && ["blog", "video"].includes(type)) query.type = type;

    if (tags) {
        const tagList = (Array.isArray(tags) ? tags : String(tags).split(","))
            .map(tag => tag.trim()).filter(Boolean).slice(0, 10);
        if (tagList.length) query.tags = { $in: tagList.map(tag => new RegExp(escapeRegex(tag), "i")) };
    }

    const now = new Date();
    let fromDate = null;
    if (dateRange === "7days") fromDate = new Date(now.getTime() - 7 * 86400000);
    if (dateRange === "30days") fromDate = new Date(now.getTime() - 30 * 86400000);
    if (dateRange === "3months" || dateRange === "6months") {
        fromDate = new Date(now);
        fromDate.setMonth(fromDate.getMonth() - (dateRange === "3months" ? 3 : 6));
    }
    if (dateRange === "thisYear") fromDate = new Date(now.getFullYear(), 0, 1);
    if (fromDate) query.createdAt = { $gte: fromDate, $lte: now };

    const sortOptions = {
        latest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        mostViewed: { views: -1, createdAt: -1 }
    };
    return { query, sort: sortOptions[sort] || sortOptions.latest };
};

// GET /api/posts — Get published posts with combined search and filters
const getPosts = async (req, res) => {
    try {
        const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const status = req.user?.role === "admin" && ["draft", "published"].includes(req.query.status)
            ? req.query.status : "published";

        const { query, sort } = await buildPostFilters(req.query, { status });
        const skip = (pageNum - 1) * limitNum;
        const total = await Post.countDocuments(query);
        let posts;

        if (req.query.sort === "mostLiked") {
            const [ranked, matchingPosts] = await Promise.all([
                Like.aggregate([
                    { $group: { _id: "$post", likesCount: { $sum: 1 } } },
                    { $sort: { likesCount: -1 } }
                ]),
                Post.find(query).populate("author", "username profileImage")
                    .populate("category", "name slug").lean()
            ]);
            const rank = new Map(ranked.map((item, index) => [item._id.toString(), index]));
            matchingPosts.sort((a, b) =>
                (rank.get(a._id.toString()) ?? Number.MAX_SAFE_INTEGER) -
                (rank.get(b._id.toString()) ?? Number.MAX_SAFE_INTEGER)
            );
            posts = matchingPosts.slice(skip, skip + limitNum);
        } else {
            posts = await Post.find(query).populate("author", "username profileImage")
                .populate("category", "name slug").sort(sort).skip(skip).limit(limitNum);
        }

        return res.status(200).json({
            success: true,
            message: "Posts fetched successfully",
            data: {
                posts,
                pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
            }
        });
    } catch (e) {
        console.error("getPosts error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/my — Get current user's own posts (all statuses)
const getMyPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const query = { author: req.user.id };
        if (status && ["draft", "published"].includes(status)) {
            query.status = status;
        }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate("author", "username profileImage")
                .populate("category", "name slug")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Post.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            message: "Your posts fetched successfully",
            data: {
                posts,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (e) {
        console.error("getMyPosts error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

// GET /api/posts/user/:userId — Get a specific user's published posts
const getUserPosts = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const query = { author: userId, status: "published" };

        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate("author", "username profileImage")
                .populate("category", "name slug")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Post.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            message: "User posts fetched",
            data: {
                posts,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (e) {
        console.error("getUserPosts error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/slug/:slug — Get a post by slug
const getPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const post = await Post.findOne({ slug })
            .populate("author", "username profileImage bio")
            .populate("category", "name slug");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        // Draft posts visible only to author or admin
        if (post.status === "draft") {
            if (!req.user) {
                return res.status(403).json({
                    success: false,
                    message: "This post is not published"
                });
            }
            const isAuthor = post.author._id.toString() === req.user.id;
            const isAdmin = req.user.role === "admin";
            if (!isAuthor && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "This post is not published"
                });
            }
        }

        // Increment view count
        await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

        return res.status(200).json({
            success: true,
            message: "Post fetched",
            data: post
        });
    } catch (e) {
        console.error("getPostBySlug error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/:id — Get a single post by ID
const getPostById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(id)
            .populate("author", "username profileImage bio")
            .populate("category", "name slug");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        // Draft posts visible only to author or admin
        if (post.status === "draft") {
            if (!req.user) {
                return res.status(403).json({
                    success: false,
                    message: "This post is not published"
                });
            }
            const isAuthor = post.author._id.toString() === req.user.id;
            const isAdmin = req.user.role === "admin";
            if (!isAuthor && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "This post is not published"
                });
            }
        }

        await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

        return res.status(200).json({
            success: true,
            message: "Post fetched",
            data: post
        });
    } catch (e) {
        console.error("getPostById error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PUT /api/posts/:id — Update a post
const updatePost = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const isAuthor = post.author.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this post"
            });
        }

        // Safe fields to update — author is never changed
        const { title, content, excerpt, type, videoUrl, tags, status, category } =
            req.body;

        if (title !== undefined) post.title = title;
        if (content !== undefined) post.content = content;
        if (excerpt !== undefined) post.excerpt = excerpt;
        if (type !== undefined && ["blog", "video"].includes(type)) post.type = type;
        if (videoUrl !== undefined) post.videoUrl = videoUrl;
        if (tags !== undefined) post.tags = tags;
        if (status !== undefined && ["draft", "published"].includes(status))
            post.status = status;
        if (category !== undefined) {
            post.category = isValidId(category) ? category : null;
        }

        if (req.file) {
            post.coverImage = `/uploads/${req.file.filename}`;
        }

        await post.save();
        await post.populate("author", "username profileImage");
        await post.populate("category", "name slug");

        return res.status(200).json({
            success: true,
            message: "Post updated successfully",
            data: post
        });
    } catch (e) {
        console.error("updatePost error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/posts/:id — Delete a post
const deletePost = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const isAuthor = post.author.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this post"
            });
        }

        // Clean up associated data
        await Promise.all([
            Like.deleteMany({ post: id }),
            Bookmark.deleteMany({ post: id }),
            Comment.deleteMany({ post: id })
        ]);

        await Post.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Post deleted successfully"
        });
    } catch (e) {
        console.error("deletePost error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export {
    createPost,
    getPosts,
    getMyPosts,
    getUserPosts,
    getPostBySlug,
    getPostById,
    updatePost,
    deletePost
};
