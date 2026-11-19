import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

import connectDB from "./db/connectDB.js";
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

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
});
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
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
app.use("/api", discoveryRouter);

app.get("/", (req, res) => res.json({ success: true, message: "Kathā API is running" }));

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
    if (err && err.message === "Only image files (jpeg, jpg, png, gif, webp) are allowed") {
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
        console.error("Unhandled request error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
    next();
});

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be configured");
        await connectDB();
        app.listen(PORT, () => console.log(`Kathā API running on http://localhost:${PORT}`));
    } catch (error) {
        console.error("Failed to start API:", error);
        process.exit(1);
    }
};
startServer();
