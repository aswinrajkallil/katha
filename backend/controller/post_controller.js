import mongoose from "mongoose";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import Bookmark from "../models/Bookmark.js";
import Follow from "../models/Follow.js";
import cloudinary from "../config/cloudinary.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import { emitToRoom, emitToAll } from "../socket.js";

// Helper: validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: attach real comment and like counts to an array of posts
const attachCommentCounts = async (posts, userId = null) => {
    if (!posts || !posts.length) return [];
    const postIds = posts.map(p => p._id);
    const [commentCounts, likeCounts, userLikes, userBookmarks] = await Promise.all([
        Comment.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]),
        Like.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]),
        userId ? Like.find({ post: { $in: postIds }, user: userId }).select("post").lean() : [],
        userId ? Bookmark.find({ post: { $in: postIds }, user: userId }).select("post").lean() : []
    ]);
    const commentMap = new Map(commentCounts.map(c => [c._id.toString(), c.count]));
    const likeMap = new Map(likeCounts.map(l => [l._id.toString(), l.count]));
    const likedSet = new Set(userLikes.map(l => l.post.toString()));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.post.toString()));

    return posts.map(p => {
        const obj = typeof p.toObject === "function" ? p.toObject() : { ...p };
        const idStr = obj._id.toString();
        return {
            ...obj,
            commentsCount: commentMap.get(idStr) || 0,
            likesCount: likeMap.get(idStr) || 0,
            likedByMe: likedSet.has(idStr),
            bookmarkedByMe: bookmarkedSet.has(idStr)
        };
    });
};

// POST /api/posts — Create a post
const createPost = async (req, res) => {
    let uploadedImage = null;

    try {
        const { title, content, excerpt, type, videoUrl, tags, status, category } =
            req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title is required"
            });
        }

        // Determine post type gracefully: if explicit type provided, use it; else if videoUrl present, mark as video; else default to blog
        const resolvedType = (type && ["blog", "video"].includes(type))
            ? type
            : (videoUrl ? "video" : "blog");

        const postData = {
            title: title.trim(),
            content: content || null,
            excerpt: excerpt || null,
            type: resolvedType,
            videoUrl: videoUrl ? videoUrl.trim() : null,
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

        // Upload cover image to Cloudinary when a file is provided
        if (req.file) {
            uploadedImage = await uploadToCloudinary(
                req.file.buffer,
                "katha/posts"
            );
            postData.coverImage = uploadedImage.url;
            postData.coverImagePublicId = uploadedImage.publicId;
        }

        const post = await Post.create(postData);
        // The database record now owns this asset; don't remove it in the catch block.
        uploadedImage = null;
        await post.populate("author", "username email profileImage");
        await post.populate("category", "name slug");

        if (post.status === "published") {
            const postPayload = {
                _id: post._id,
                title: post.title,
                excerpt: post.excerpt,
                type: post.type,
                coverImage: post.coverImage,
                createdAt: post.createdAt,
                author: post.author
            };
            emitToAll("post:created", { post: postPayload, authorId: req.user.id });
            Follow.find({ following: req.user.id }).select("follower").lean().then(followers => {
                followers.forEach(f => {
                    emitToRoom(`user:${f.follower}`, "post:created", { post: postPayload, authorId: req.user.id });
                });
            }).catch(err => console.error("Error broadcasting post:created:", err));
        }

        return res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: post
        });
    } catch (e) {
        if (uploadedImage?.publicId) {
            try {
                await cloudinary.uploader.destroy(uploadedImage.publicId, {
                    resource_type: "image"
                });
            } catch (cleanupError) {
                console.error("Failed to clean up uploaded post image:", cleanupError);
            }
        }
        console.error('createPost error details:', e);
        if (e.code === "CLOUDINARY_CONFIG_MISSING") {
            return res.status(502).json({
                success: false,
                message: e.message || "Cloudinary configuration missing",
                errorType: "CLOUDINARY_CONFIG_MISSING"
            });
        }
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
    const { search, category, type, tags, sort, author, hasVideo } = filters;

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

    if (author && isValidId(author)) {
        query.author = author;
    }

    if (hasVideo === "true" || hasVideo === true) {
        query.videoUrl = { $exists: true, $ne: "" };
    }

    if (tags) {
        const tagList = (Array.isArray(tags) ? tags : String(tags).split(","))
            .map(tag => tag.trim()).filter(Boolean).slice(0, 10);
        if (tagList.length) query.tags = { $in: tagList.map(tag => new RegExp(escapeRegex(tag), "i")) };
    }

    const sortOptions = {
        latest: { createdAt: -1, _id: -1 },
        oldest: { createdAt: 1, _id: 1 },
        mostViewed: { views: -1, createdAt: -1, _id: -1 },
        views: { views: -1, createdAt: -1, _id: -1 }
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

        if (req.query.sort === "mostLiked" || req.query.sort === "likes") {
            const [ranked, matchingPosts] = await Promise.all([
                Like.aggregate([
                    { $group: { _id: "$post", likesCount: { $sum: 1 } } },
                    { $sort: { likesCount: -1 } }
                ]),
                Post.find(query).populate("author", "username profileImage")
                    .populate("category", "name slug").lean()
            ]);
            const rank = new Map(ranked.map((item, index) => [item._id.toString(), index]));
            matchingPosts.sort((a, b) => {
                const aRank = rank.get(a._id.toString()) ?? Number.MAX_SAFE_INTEGER;
                const bRank = rank.get(b._id.toString()) ?? Number.MAX_SAFE_INTEGER;
                if (aRank !== bRank) return aRank - bRank;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            posts = matchingPosts.slice(skip, skip + limitNum);
        } else if (req.query.sort === "mostCommented" || req.query.sort === "comments") {
            const [ranked, matchingPosts] = await Promise.all([
                Comment.aggregate([
                    { $match: { isDeleted: { $ne: true } } },
                    { $group: { _id: "$post", count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ]),
                Post.find(query).populate("author", "username profileImage")
                    .populate("category", "name slug").lean()
            ]);
            const rank = new Map(ranked.map((item, index) => [item._id.toString(), index]));
            matchingPosts.sort((a, b) => {
                const aRank = rank.get(a._id.toString()) ?? Number.MAX_SAFE_INTEGER;
                const bRank = rank.get(b._id.toString()) ?? Number.MAX_SAFE_INTEGER;
                if (aRank !== bRank) return aRank - bRank;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            posts = matchingPosts.slice(skip, skip + limitNum);
        } else {
            posts = await Post.find(query).populate("author", "username profileImage")
                .populate("category", "name slug").sort(sort).skip(skip).limit(limitNum);
        }

        const postsWithCounts = await attachCommentCounts(posts, req.user?.id);

        return res.status(200).json({
            success: true,
            message: "Posts fetched successfully",
            data: {
                posts: postsWithCounts,
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

        const postsWithCounts = await attachCommentCounts(posts, req.user?.id);

        return res.status(200).json({
            success: true,
            message: "Your posts fetched successfully",
            data: {
                posts: postsWithCounts,
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

        const postsWithCounts = await attachCommentCounts(posts, req.user?.id);

        return res.status(200).json({
            success: true,
            message: "User posts fetched",
            data: {
                posts: postsWithCounts,
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
        const [commentsCount, likesCount, userLike, userBookmark] = await Promise.all([
            Comment.countDocuments({ post: post._id }),
            Like.countDocuments({ post: post._id }),
            req.user?.id ? Like.exists({ post: post._id, user: req.user.id }) : false,
            req.user?.id ? Bookmark.exists({ post: post._id, user: req.user.id }) : false,
            Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } })
        ]);

        return res.status(200).json({
            success: true,
            message: "Post fetched",
            data: {
                ...post.toObject(),
                commentsCount,
                likesCount,
                likedByMe: Boolean(userLike),
                bookmarkedByMe: Boolean(userBookmark)
            }
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

        const [commentsCount, likesCount, userLike, userBookmark] = await Promise.all([
            Comment.countDocuments({ post: post._id }),
            Like.countDocuments({ post: post._id }),
            req.user?.id ? Like.exists({ post: post._id, user: req.user.id }) : false,
            req.user?.id ? Bookmark.exists({ post: post._id, user: req.user.id }) : false,
            Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } })
        ]);

        return res.status(200).json({
            success: true,
            message: "Post fetched",
            data: {
                ...post.toObject(),
                commentsCount,
                likesCount,
                likedByMe: Boolean(userLike),
                bookmarkedByMe: Boolean(userBookmark)
            }
        });
    } catch (e) {
        console.error("getPostById error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PUT /api/posts/:id — Update a post
const updatePost = async (req, res) => {
    let uploadedImage = null;

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

        const wasPublished = post.status === "published";

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

        // Upload the replacement first; keep the existing image if upload fails.
        const previousImagePublicId = post.coverImagePublicId;

        if (req.file) {
            uploadedImage = await uploadToCloudinary(
                req.file.buffer,
                "katha/posts"
            );
            post.coverImage = uploadedImage.url;
            post.coverImagePublicId = uploadedImage.publicId;
        }

        await post.save();

        // The saved post now references the new asset.
        uploadedImage = null;

        // Remove the previous Cloudinary asset only after the database save succeeds.
        if (req.file && previousImagePublicId) {
            try {
                await cloudinary.uploader.destroy(previousImagePublicId, {
                    resource_type: "image"
                });
            } catch (cleanupError) {
                console.error("Failed to delete previous post image:", cleanupError);
            }
        }
        await post.populate("author", "username profileImage");
        await post.populate("category", "name slug");

        if (!wasPublished && post.status === "published") {
            const postPayload = {
                _id: post._id,
                title: post.title,
                excerpt: post.excerpt,
                type: post.type,
                coverImage: post.coverImage,
                createdAt: post.createdAt,
                author: post.author
            };
            emitToAll("post:created", { post: postPayload, authorId: req.user.id });
            Follow.find({ following: req.user.id }).select("follower").lean().then(followers => {
                followers.forEach(f => {
                    emitToRoom(`user:${f.follower}`, "post:created", { post: postPayload, authorId: req.user.id });
                });
            }).catch(err => console.error("Error broadcasting post:created:", err));
        }

        return res.status(200).json({
            success: true,
            message: "Post updated successfully",
            data: post
        });
    } catch (e) {
        if (uploadedImage?.publicId) {
            try {
                await cloudinary.uploader.destroy(uploadedImage.publicId, {
                    resource_type: "image"
                });
            } catch (cleanupError) {
                console.error("Failed to clean up replacement post image:", cleanupError);
            }
        }
        console.error("updatePost error:", e);
        if (e.code === "CLOUDINARY_CONFIG_MISSING") {
            return res.status(502).json({
                success: false,
                message: e.message || "Cloudinary configuration missing",
                errorType: "CLOUDINARY_CONFIG_MISSING"
            });
        }
        return res.status(500).json({ success: false, message: e.message || "Something went wrong" });
    }
};

// DELETE /api/posts/:id — Soft delete a post (moves it to Deleted Posts)
// Likes, comments, bookmarks and the cover image are kept so the post can be restored.
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

        post.isDeleted = true;
        post.deletedAt = new Date();
        post.deletedBy = req.user.id;
        await post.save();

        // Let open feeds drop the post straight away
        emitToAll("post:deleted", { postId: id });
        emitToRoom(`post:${id}`, "post:deleted", { postId: id });

        return res.status(200).json({
            success: true,
            message: "Post moved to Deleted Posts",
            data: { _id: post._id, deletedAt: post.deletedAt }
        });
    } catch (e) {
        console.error("deletePost error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/deleted — Current user's soft-deleted posts, most recently deleted first
const getDeletedPosts = async (req, res) => {
    try {
        const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        // Filtering on isDeleted explicitly bypasses the default "hide deleted" filter
        const query = { author: req.user.id, isDeleted: true };

        const [posts, total] = await Promise.all([
            Post.find(query)
                .select("title excerpt content type status coverImage videoUrl videoThumbnail views createdAt deletedAt")
                .sort({ deletedAt: -1, _id: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Post.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            message: "Deleted posts fetched",
            data: {
                posts: posts.map(({ content, ...rest }) => ({
                    ...rest,
                    excerpt: rest.excerpt || (content ? content.slice(0, 160) : null)
                })),
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (e) {
        console.error("getDeletedPosts error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PATCH /api/posts/:id/restore — Bring a soft-deleted post back
const restorePost = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findOne({ _id: id, isDeleted: true });

        if (!post) {
            return res.status(404).json({ success: false, message: "Deleted post not found" });
        }

        const isAuthor = post.author.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to restore this post"
            });
        }

        post.isDeleted = false;
        post.deletedAt = null;
        post.deletedBy = null;
        await post.save();

        return res.status(200).json({
            success: true,
            message: "Post restored",
            data: { _id: post._id, status: post.status }
        });
    } catch (e) {
        console.error("restorePost error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/posts/:id/permanent — Permanently remove a post that is already in Deleted Posts
const permanentlyDeletePost = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findOne({ _id: id, isDeleted: true });

        if (!post) {
            return res.status(404).json({ success: false, message: "Deleted post not found" });
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

        await Post.deleteOne({ _id: id });

        // Delete the Cloudinary asset if this post has one.
        // Legacy local-upload images have no public ID and are left untouched.
        if (post.coverImagePublicId) {
            try {
                await cloudinary.uploader.destroy(post.coverImagePublicId, {
                    resource_type: "image"
                });
            } catch (cleanupError) {
                console.error("Failed to delete post image from Cloudinary:", cleanupError);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Post permanently deleted"
        });
    } catch (e) {
        console.error("permanentlyDeletePost error:", e);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/posts/sidebar
// Returns the right-hand feed sidebar as an ordered list of sections.
// Rules:
//   - Sections come back in priority order (most important first).
//   - A section with no items is NEVER returned, so the UI can't render an empty card.
//   - At most SIDEBAR_MAX_SECTIONS sections are returned; lower-priority ones act as
//     fallbacks and only appear when higher-priority ones have nothing to show
//     (that is how "at least 2 sections" is reached whenever the site has enough content).
//   - A post is never repeated across the post sections (bookmarks are personal and exempt).
const SIDEBAR_POST_FIELDS = "_id title coverImage videoThumbnail type views createdAt author";
const SIDEBAR_MAX_SECTIONS = 4;
const SIDEBAR_POST_LIMIT = 5;

const getSidebarPosts = async (req, res) => {
    try {
        const userId = req.user?.id ? String(req.user.id) : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

        const loadPosts = (filter, sort, n) =>
            Post.find({ status: "published", ...filter })
                .select(SIDEBAR_POST_FIELDS)
                .populate("author", "username fullName profileImage")
                .sort(sort)
                .limit(n)
                .lean();

        // ---------------------------------------------------------------
        // 1. TRENDING — real engagement in the last 7 days, with time decay.
        //    Likes x3, comments x4, bookmarks x3, views x0.1, divided by
        //    (ageInHours + 2) ^ 1.2. Posts with zero recent engagement are
        //    not trending, so there is deliberately no "fill with anything" fallback.
        // ---------------------------------------------------------------
        const recentWindow = { createdAt: { $gte: sevenDaysAgo } };
        const countByPost = (Model, extra = {}) =>
            Model.aggregate([
                { $match: { ...recentWindow, ...extra } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]);

        const [recentLikes, recentComments, recentBookmarks] = await Promise.all([
            countByPost(Like),
            countByPost(Comment, { isDeleted: { $ne: true } }),
            countByPost(Bookmark)
        ]);

        const rawScore = new Map();
        const addScore = (rows, weight) =>
            rows.forEach(r => {
                const id = r._id.toString();
                rawScore.set(id, (rawScore.get(id) || 0) + r.count * weight);
            });
        addScore(recentLikes, 3);
        addScore(recentComments, 4);
        addScore(recentBookmarks, 3);

        let trending = [];
        if (rawScore.size > 0) {
            const candidates = await loadPosts(
                { _id: { $in: Array.from(rawScore.keys()) } },
                { createdAt: -1 },
                200
            );
            const nowMs = Date.now();
            trending = candidates
                .map(post => {
                    const ageHours = Math.max(0, (nowMs - new Date(post.createdAt).getTime()) / 3600000);
                    const decay = 1 / Math.pow(ageHours + 2, 1.2);
                    const score = ((rawScore.get(post._id.toString()) || 0) + (post.views || 0) * 0.1) * decay;
                    return { post, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, SIDEBAR_POST_LIMIT)
                .map(x => x.post);
        }

        const usedIds = trending.map(p => p._id);

        // ---------------------------------------------------------------
        // 2. FROM PEOPLE YOU FOLLOW (logged-in only)
        // ---------------------------------------------------------------
        let followingIds = [];
        let following = [];
        if (userId) {
            const follows = await Follow.find({ follower: userId }).select("following").lean();
            followingIds = follows.map(f => f.following);
            if (followingIds.length) {
                following = await loadPosts(
                    { author: { $in: followingIds }, _id: { $nin: usedIds } },
                    { createdAt: -1 },
                    4
                );
                usedIds.push(...following.map(p => p._id));
            }
        }

        // ---------------------------------------------------------------
        // 3. AUTHORS — "Who to follow" (logged in) / "Top creators" (guest)
        // ---------------------------------------------------------------
        const authorMatch = { status: "published" };
        if (userId) {
            authorMatch.author = {
                $nin: [new mongoose.Types.ObjectId(userId), ...followingIds]
            };
        }
        const authorRows = await Post.aggregate([
            { $match: authorMatch },
            { $group: { _id: "$author", postCount: { $sum: 1 }, totalViews: { $sum: { $ifNull: ["$views", 0] } } } },
            { $sort: { postCount: -1, totalViews: -1 } },
            { $limit: 4 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
            { $unwind: "$u" },
            {
                $project: {
                    postCount: 1,
                    username: "$u.username",
                    fullName: "$u.fullName",
                    profileImage: "$u.profileImage"
                }
            }
        ]);
        let authors = [];
        if (authorRows.length) {
            const followerRows = await Follow.aggregate([
                { $match: { following: { $in: authorRows.map(a => a._id) } } },
                { $group: { _id: "$following", count: { $sum: 1 } } }
            ]);
            const followerMap = new Map(followerRows.map(f => [f._id.toString(), f.count]));
            authors = authorRows.map(a => ({
                _id: a._id,
                username: a.username,
                fullName: a.fullName || null,
                profileImage: a.profileImage || null,
                postCount: a.postCount,
                followersCount: followerMap.get(a._id.toString()) || 0
            }));
        }

        // ---------------------------------------------------------------
        // 4. MOST RECENT — never repeats a post already shown above
        // ---------------------------------------------------------------
        const recent = await loadPosts({ _id: { $nin: usedIds } }, { createdAt: -1, _id: -1 }, SIDEBAR_POST_LIMIT);
        usedIds.push(...recent.map(p => p._id));

        // ---------------------------------------------------------------
        // 5. YOUR BOOKMARKS (logged-in only, personal so not de-duplicated)
        // ---------------------------------------------------------------
        let bookmarks = [];
        if (userId) {
            const rows = await Bookmark.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate({
                    path: "post",
                    match: { status: "published" },
                    select: SIDEBAR_POST_FIELDS,
                    populate: { path: "author", select: "username fullName profileImage" }
                })
                .lean();
            bookmarks = rows.map(r => r.post).filter(Boolean).slice(0, 4);
        }

        // ---------------------------------------------------------------
        // 6. MOST VIEWED — lowest priority fallback
        // ---------------------------------------------------------------
        const popular = await loadPosts(
            { _id: { $nin: usedIds }, views: { $gt: 0 } },
            { views: -1, createdAt: -1 },
            SIDEBAR_POST_LIMIT
        );

        // ---------------------------------------------------------------
        // Batch likes + comments counts for every post we are about to return
        // ---------------------------------------------------------------
        const allPosts = [...trending, ...following, ...recent, ...bookmarks, ...popular];
        const allIds = [...new Set(allPosts.map(p => p._id.toString()))].map(id => new mongoose.Types.ObjectId(id));
        const [likeAgg, commentAgg] = allIds.length
            ? await Promise.all([
                Like.aggregate([
                    { $match: { post: { $in: allIds } } },
                    { $group: { _id: "$post", count: { $sum: 1 } } }
                ]),
                Comment.aggregate([
                    { $match: { post: { $in: allIds }, isDeleted: { $ne: true } } },
                    { $group: { _id: "$post", count: { $sum: 1 } } }
                ])
            ])
            : [[], []];
        const likeMap = new Map(likeAgg.map(r => [r._id.toString(), r.count]));
        const commentMap = new Map(commentAgg.map(r => [r._id.toString(), r.count]));

        const formatPost = (p) => ({
            _id: p._id,
            title: p.title,
            coverImage: p.coverImage || null,
            videoThumbnail: p.videoThumbnail || null,
            type: p.type || "blog",
            views: p.views || 0,
            likesCount: likeMap.get(p._id.toString()) || 0,
            commentsCount: commentMap.get(p._id.toString()) || 0,
            createdAt: p.createdAt,
            author: p.author
                ? {
                    _id: p.author._id,
                    username: p.author.username,
                    fullName: p.author.fullName || null,
                    profileImage: p.author.profileImage || null
                }
                : null
        });

        // Priority order = display order. Empty sections are dropped, then we cap the count.
        const ordered = [
            { key: "trending", title: "Trending", badge: "Last 7 days", kind: "posts", ranked: true, items: trending.map(formatPost) },
            { key: "following", title: "From people you follow", kind: "posts", items: following.map(formatPost) },
            { key: "authors", title: userId ? "Who to follow" : "Top creators", kind: "authors", items: authors },
            { key: "recent", title: "Most recent", badge: "Latest", kind: "posts", items: recent.map(formatPost) },
            { key: "bookmarks", title: "Your bookmarks", kind: "posts", href: "/bookmarks", items: bookmarks.map(formatPost) },
            { key: "popular", title: "Most viewed", kind: "posts", items: popular.map(formatPost) }
        ];

        const sections = ordered.filter(s => s.items.length > 0).slice(0, SIDEBAR_MAX_SECTIONS);

        return res.status(200).json({ success: true, data: { sections } });
    } catch (err) {
        console.error("getSidebarPosts error:", err);
        return res.status(500).json({ success: false, message: "Unable to load sidebar" });
    }
};

export {
    createPost,
    getPosts,
    getMyPosts,
    getSidebarPosts,
    getUserPosts,
    getPostBySlug,
    getPostById,
    updatePost,
    deletePost,
    getDeletedPosts,
    restorePost,
    permanentlyDeletePost
};
