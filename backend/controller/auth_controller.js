import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateRefreshToken, generateToken } from "../utils/jwt.js";

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, email, and password are required"
            });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (e) {
        console.error("Register error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const passwordValid = await bcrypt.compare(password, user.password);

        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const refreshToken = generateRefreshToken(user);
        const accessToken = generateToken(user);

        user.refreshToken = refreshToken;
        await user.save();

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/"
        });

        return res.status(200).json({
            success: true,
            message: "Logged in successfully",
            data: {
                accessToken,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    profileImage: user.profileImage,
                    bio: user.bio
                }
            }
        });
    } catch (e) {
        console.error("Login error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
        return res.status(401).json({
            success: false,
            message: "Refresh token missing"
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        // Rotate refresh token
        const newRefreshToken = generateRefreshToken(user);
        const accessToken = generateToken(user);

        user.refreshToken = newRefreshToken;
        await user.save();

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/"
        });

        return res.status(200).json({
            success: true,
            data: { accessToken }
        });
    } catch (e) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired refresh token"
        });
    }
};

const logout = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (refreshToken) {
            const user = await User.findOne({ refreshToken });
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
        }

        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (e) {
        console.error("Logout error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(
            "-password -refreshToken"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User profile fetched",
            data: user
        });
    } catch (e) {
        console.error("GetMe error:", e);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

export { register, login, refreshAccessToken, logout, getMe };
