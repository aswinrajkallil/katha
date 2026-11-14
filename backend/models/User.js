import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required"],
            trim: true
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: [true, "Password is required"]
        },
        profileImage: {
            type: String,
            default: null
        },
        bio: {
            type: String,
            default: null
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },
        refreshToken: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
