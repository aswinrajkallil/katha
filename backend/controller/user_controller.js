import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/users/:id — Public profile
const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const query = isValidId(id) ? { _id: id } : { username: id };

        const user = await User.findOne(query).select("-password -refreshToken -email");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({ success: true, message: "User profile fetched", data: user });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PUT /api/users/profile — Update own profile
const updateProfile = async (req, res) => {
    try {
        const { username, bio } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (username) user.username = username;
        if (bio !== undefined) user.bio = bio;

        if (req.file) {
            user.profileImage = `/uploads/${req.file.filename}`;
        }

        await user.save();

        const updatedUser = user.toObject();
        delete updatedUser.password;
        delete updatedUser.refreshToken;

        return res.status(200).json({
            success: true,
            message: "Profile updated",
            data: updatedUser
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { getUserProfile, updateProfile };
