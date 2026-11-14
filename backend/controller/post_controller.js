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
            tags: tags || [],
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
        console.error("createPost error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

// GET /api/posts — Get all published posts (with optional search/filter/pagination)
const getPosts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            category,
            type,
            status
        } = req.query;

        const query = {};

        // Public gets only published posts; admin can filter by status
        if (req.user && req.user.role === "admin" && status) {
            query.status = status;
        } else {
            query.status = "published";
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } },
                { excerpt: { $regex: search, $options: "i" } }
            ];
        }

        if (category && isValidId(category)) {
            query.category = category;
        }

        if (type && ["blog", "video"].includes(type)) {
            query.type = type;
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
            message: "Posts fetched successfully",
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
        console.error("getPosts error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
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
