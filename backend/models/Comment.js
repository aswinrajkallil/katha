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
        }
    },
    { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });
commentSchema.index({ parentComment: 1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
