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
        }
    },
    { timestamps: true }
);

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
            const existing = await mongoose.model("Post").findOne({
                slug,
                _id: { $ne: this._id }
            });
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
postSchema.index({ title: "text", content: "text" });

const Post = mongoose.model("Post", postSchema);

export default Post;
