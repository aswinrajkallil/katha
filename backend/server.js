import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth routes
app.use("/api", authRouter);

// Post routes
app.use("/api/posts", postRouter);

// Comment routes (nested under posts) + standalone
app.use("/api/posts/:postId/comments", commentRouter);
app.use("/api/comments", commentStandaloneRouter);

// Like routes (nested under posts)
app.use("/api/posts/:postId", likeRouter);

// Bookmark routes — nested under posts + standalone
app.use("/api/posts/:postId", bookmarkPostRouter);
app.use("/api/bookmarks", bookmarkRouter);

// Category routes
app.use("/api/categories", categoryRouter);

// User routes
app.use("/api/users", userRouter);

app.get("/", (req, res) => {
    res.json({ success: true, message: "Kathā API is running" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
