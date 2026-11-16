import mongoose from "mongoose";

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
    role: { type: String, enum: ["user", "admin"], default: "user" },
    refreshToken: { type: String, default: null }
}, { timestamps: true });


const User = mongoose.model("User", userSchema);
export default User;
