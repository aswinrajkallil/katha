import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        content: {
            type: String,
            required: [true, "Comment content is required"],
            trim: true
        },
        parentComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
            default: null
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        isEdited: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        // Moderation metadata. When staff remove a comment the original `content` is kept so the
        // removal can be undone; the public API masks deleted comments at read time.
        // `deletedBy` equal to the author (or empty on legacy rows) means the author deleted it,
        // which is not restorable because the text was already overwritten.
        deletedAt: {
            type: Date,
            default: null
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        moderationReason: {
            type: String,
            default: null,
            maxlength: 1000
        }
    },
    { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ isDeleted: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
