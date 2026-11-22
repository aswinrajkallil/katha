import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { isAllowedOrigin } from "./utils/corsOrigin.js";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

import authRouter from "./routes/auth_route.js";
import postRouter from "./routes/post_route.js";
import categoryRouter from "./routes/category_route.js";
import commentRouter from "./routes/comment_route.js";
import commentStandaloneRouter from "./routes/comment_standalone_route.js";
import likeRouter from "./routes/like_route.js";
import bookmarkRouter from "./routes/bookmark_route.js";
import bookmarkPostRouter from "./routes/bookmark_post_route.js";
import userRouter from "./routes/user_route.js";
import feedRouter from "./routes/feed_route.js";
import notificationRouter from "./routes/notification_route.js";
import discoveryRouter from "./routes/discovery_route.js";
import adminRouter from "./routes/admin_route.js";
import reportRouter from "./routes/report_route.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
});
export const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""));

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
        callback(null, false);
    },
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", authRouter);
app.use("/api/posts", postRouter);
app.use("/api/posts/:postId/comments", commentRouter);
app.use("/api/comments", commentStandaloneRouter);
app.use("/api/posts/:postId", likeRouter);
app.use("/api/posts/:postId", bookmarkPostRouter);
app.use("/api/bookmarks", bookmarkRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/users", userRouter);
app.use("/api/feed", feedRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reports", reportRouter);
app.use("/api", discoveryRouter);

app.get("/", (req, res) => res.json({ success: true, message: "Kathā API is running" }));

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "File size exceeds the 5MB limit"
            : (err.message || "File upload error");
        return res.status(status).json({ success: false, message, errorType: err.code });
    }
    if (err && (err.code === "INVALID_FILE_TYPE" || /images? are allowed/i.test(err.message))) {
        console.error("File filter error:", err);
        return res.status(400).json({ success: false, message: err.message, errorType: "INVALID_FILE_TYPE" });
    }
    if (err && (err.code === "CLOUDINARY_CONFIG_MISSING" || err.code === "STORAGE_ERROR" || err.http_code)) {
        console.error("Cloudinary / Storage error:", err);
        return res.status(502).json({
            success: false,
            message: err.message || "Failed to upload image to cloud storage",
            errorType: "STORAGE_ERROR"
        });
    }
    if (err) {
        console.error("Unhandled request error:", err);
        return res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
    next();
});

export default app;
