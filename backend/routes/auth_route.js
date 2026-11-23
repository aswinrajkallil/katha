import express from "express";
import { register, login, refreshAccessToken, logout, getMe, checkUsername, forgotPassword, resetPassword } from "../controller/auth_controller.js";
import authenticate from "../middleware/authMiddleware.js";
import rateLimit from "../middleware/rateLimit.js";

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts. Try again in 15 minutes." });
const checkLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
// Password reset: limited per IP, and per email address so one inbox cannot be flooded from many IPs.
const resetWindow = 15 * 60 * 1000;
const resetRequestIpLimiter = rateLimit({ windowMs: resetWindow, max: 5, message: "Too many password reset requests. Try again in 15 minutes." });
const resetRequestEmailLimiter = rateLimit({
    windowMs: resetWindow,
    max: 3,
    message: "Too many password reset requests. Try again in 15 minutes.",
    keyGenerator: (req) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        return email ? `reset:${email}` : null;
    }
});
const resetSubmitLimiter = rateLimit({ windowMs: resetWindow, max: 10, message: "Too many attempts. Try again in 15 minutes." });
router.get("/check-username", checkLimiter, checkUsername);
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", resetRequestIpLimiter, resetRequestEmailLimiter, forgotPassword);
router.post("/reset-password/:token", resetSubmitLimiter, resetPassword);
router.get("/me", authenticate, getMe);
export default router;
