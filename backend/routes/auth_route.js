import express from "express";
import { register, login, refreshAccessToken, logout, getMe } from "../controller/auth_controller.js";
import authenticate from "../middleware/authMiddleware.js";
import rateLimit from "../middleware/rateLimit.js";

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts. Try again in 15 minutes." });
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), refreshAccessToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
export default router;
