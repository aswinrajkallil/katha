import mongoose from "mongoose";

export const REPORT_TARGET_TYPES = Object.freeze(["post", "comment", "user"]);
export const REPORT_REASONS = Object.freeze([
    "spam",
    "harassment",
    "hate_speech",
    "inappropriate_content",
    "impersonation",
    "copyright_violation",
    "misinformation",
    "other"
]);
export const REPORT_STATUSES = Object.freeze(["pending", "under_review", "resolved", "dismissed"]);
export const REPORT_RESOLUTION_ACTIONS = Object.freeze(["none", "remove_content", "deactivate_account"]);

const reportSchema = new mongoose.Schema(
    {
        reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
        targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
        // Whose content/account is being reported. Used for conflict-of-interest checks and so a
        // moderator can see who is involved without loading the target.
        targetOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        // Human-readable snapshot captured at report time (post title, comment excerpt, @username)
        targetLabel: { type: String, default: "", maxlength: 200 },
        reason: { type: String, enum: REPORT_REASONS, required: true },
        description: { type: String, default: "", trim: true, maxlength: 1000 },
        status: { type: String, enum: REPORT_STATUSES, default: "pending" },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        resolution: { type: String, default: "", trim: true, maxlength: 1000 },
        resolutionAction: { type: String, enum: REPORT_RESOLUTION_ACTIONS, default: "none" },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        resolvedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

// One report per reporter per target, ever. Stops repeat-reporting and report-flooding at the
// database level, even if two requests race past the application check.
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ assignedTo: 1, status: 1 });
reportSchema.index({ reason: 1, createdAt: -1 });
reportSchema.index({ targetOwner: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
