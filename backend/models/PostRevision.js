import mongoose from "mongoose";

// Snapshot of a post's fields taken *before* a staff edit overwrites them, so an administrative
// edit never silently destroys the author's original text.
const postRevisionSchema = new mongoose.Schema(
    {
        post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        editedByUsername: { type: String, default: null },
        editedByRole: { type: String, default: null },
        reason: { type: String, default: "", maxlength: 1000 },
        changedFields: { type: [String], default: [] },
        before: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

postRevisionSchema.index({ post: 1, createdAt: -1 });

const PostRevision = mongoose.model("PostRevision", postRevisionSchema);
export default PostRevision;
