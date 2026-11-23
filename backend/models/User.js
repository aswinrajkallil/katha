import mongoose from "mongoose";
import { ROLE_VALUES } from "../utils/permissions.js";

const userSchema = new mongoose.Schema({
    username: {
        type: String, required: [true, "Username is required"], trim: true,
        lowercase: true, minlength: 3, maxlength: 30, unique: true,
        match: [/^[a-z0-9_.]+$/, "Username may contain lowercase letters, numbers, underscores and dots"]
    },
    email: {
        type: String, required: [true, "Email is required"], unique: true,
        lowercase: true, trim: true
    },
    password: { type: String, required: [true, "Password is required"] },
    fullName: { type: String, trim: true, maxlength: 80, default: "" },
    profileImage: { type: String, default: null },
    profileImagePublicId: { type: String, default: null },
    coverImage: { type: String, default: null },
    coverImagePublicId: { type: String, default: null },
    bio: { type: String, trim: true, maxlength: 300, default: "" },
    location: { type: String, trim: true, maxlength: 100, default: "" },
    website: { type: String, trim: true, maxlength: 200, default: "" },
    // Never settable through registration or profile updates. Changed only by the Super Admin
    // role endpoint or the server-side provisioning script.
    role: { type: String, enum: ROLE_VALUES, default: "user" },
    roleChangedAt: { type: Date, default: null },
    roleChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastActiveAt: { type: Date, default: null },
    refreshToken: { type: String, default: null },
    // Password reset. Only the SHA-256 hash of the emailed token is stored (never the token itself),
    // and both fields are hidden from queries unless explicitly selected.
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    // Soft delete: a deleted account stays in the database so an admin can restore it.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

// Hide soft-deleted users from every read by default (login, refresh, profiles, populate...),
// so no controller has to remember to filter them. To read deleted users, either filter on
// `isDeleted` explicitly (e.g. { isDeleted: true }) or opt in with
// `.setOptions({ withDeleted: true })`. Same pattern as the Post model.
const FILTERED_QUERY_OPS = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "countDocuments"
];

userSchema.pre(FILTERED_QUERY_OPS, function () {
    if (this.getOptions().withDeleted) return;
    if (this.getFilter().isDeleted !== undefined) return;
    this.where({ isDeleted: { $ne: true } });
});

userSchema.index({ isDeleted: 1, deletedAt: -1 });
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });
// Reset links are looked up by token hash.
userSchema.index({ passwordResetToken: 1 });

const User = mongoose.model("User", userSchema);
export default User;
