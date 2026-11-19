import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Post title is required"],
            trim: true
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true
        },
        content: {
            type: String,
            default: null
        },
        excerpt: {
            type: String,
            default: null
        },
        type: {
            type: String,
            default: "blog"
        },
        coverImage: {
            type: String,
            default: null
        },
        coverImagePublicId: {
            type: String,
            default: null
        },
        videoUrl: {
            type: String,
            default: null
        },
        videoThumbnail: {
            type: String,
            default: null
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null
        },
        tags: {
            type: [String],
            default: []
        },
        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft"
        },
        views: {
            type: Number,
            default: 0
        },
        // Soft delete: a deleted post stays in the database so it can be restored.
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    { timestamps: true }
);

// Hide soft-deleted posts from every read by default, so no controller has to remember
// to filter them. To read deleted posts, either filter on `isDeleted` explicitly
// (e.g. { isDeleted: true }) or opt in with `.setOptions({ withDeleted: true })`.
const FILTERED_QUERY_OPS = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "countDocuments"
];

postSchema.pre(FILTERED_QUERY_OPS, function () {
    if (this.getOptions().withDeleted) return;
    if (this.getFilter().isDeleted !== undefined) return;
    this.where({ isDeleted: { $ne: true } });
});

postSchema.pre("aggregate", function () {
    if (this.options?.withDeleted) return;
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});

// Auto-generate unique slug from title
postSchema.pre("save", async function () {
    if (this.isModified("title") || this.isNew) {
        const baseSlug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        let slug = baseSlug;
        let count = 1;

        // Keep trying until we find a unique slug
        while (true) {
            // Include soft-deleted posts: the unique slug index still covers them.
            const existing = await mongoose.model("Post").findOne({
                slug,
                _id: { $ne: this._id }
            }).setOptions({ withDeleted: true });
            if (!existing) break;
            slug = `${baseSlug}-${count}`;
            count++;
        }

        this.slug = slug;
    }
});

// Indexes for performance
postSchema.index({ author: 1, status: 1 });
postSchema.index({ category: 1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ author: 1, isDeleted: 1, deletedAt: -1 });
postSchema.index({ title: "text", content: "text" });

const Post = mongoose.model("Post", postSchema);

export default Post;
