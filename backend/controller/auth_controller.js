import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, timingSafeEqual } from "crypto";
import { generateRefreshToken, generateToken } from "../utils/jwt.js";

const hashToken = token => createHash("sha256").update(token).digest("hex");
const tokenMatches = (stored, token) => {
    if (!stored || !token) return false;
    const candidate = hashToken(token);
    const expected = stored.length === candidate.length ? stored : candidate;
    try { return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate)); }
    catch { return stored === token; }
};

const setRefreshCookie = (res, token) => res.cookie("refreshToken", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/"
});

const register = async (req, res) => {
    try {
        const username = typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password;
        if (!/^[a-z0-9_]{3,30}$/.test(username)) return res.status(400).json({ success: false, message: "Username must be 3–30 characters using letters, numbers or underscores" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address" });
        if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters" });
        const exists = await User.findOne({ $or: [{ email }, { username }] }).select("_id");
        if (exists) return res.status(409).json({ success: false, message: "Email or username is already registered" });
        const user = await User.create({ username, email, password: await bcrypt.hash(password, 12) });
        return res.status(201).json({ success: true, message: "User registered successfully", data: { id: user._id, _id: user._id, username: user.username, email: user.email, role: user.role } });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "Email or username is already registered" });
        console.error("register:", error);
        return res.status(500).json({ success: false, message: "Registration failed" });
    }
};

const login = async (req, res) => {
    try {
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password;
        if (!email || typeof password !== "string") return res.status(400).json({ success: false, message: "Email and password are required" });
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Invalid email or password" });
        const refreshToken = generateRefreshToken(user);
        const accessToken = generateToken(user);
        user.refreshToken = hashToken(refreshToken);
        await user.save();
        setRefreshCookie(res, refreshToken);
        return res.json({ success: true, message: "Logged in successfully", data: {
            accessToken, user: { id: user._id, _id: user._id, username: user.username, fullName: user.fullName,
                email: user.email, role: user.role, profileImage: user.profileImage, bio: user.bio }
        } });
    } catch (error) {
        console.error("login:", error);
        return res.status(500).json({ success: false, message: "Login failed" });
    }
};

const refreshAccessToken = async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: "Refresh token missing" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || !tokenMatches(user.refreshToken, token)) {
            res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }
        const nextRefresh = generateRefreshToken(user);
        user.refreshToken = hashToken(nextRefresh);
        await user.save();
        setRefreshCookie(res, nextRefresh);
        return res.json({ success: true, data: { accessToken: generateToken(user) } });
    } catch (error) {
        res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
                const user = await User.findById(decoded.id);
                if (user && tokenMatches(user.refreshToken, token)) {
                    user.refreshToken = null;
                    await user.save();
                }
            } catch (_) {}
        }
        res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("logout:", error);
        return res.status(500).json({ success: false, message: "Logout failed" });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -refreshToken");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        return res.json({ success: true, data: user });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to fetch account" });
    }
};

export { register, login, refreshAccessToken, logout, getMe };
