import express from "express";
import { searchAll, getTrendingPosts, getPopularAuthors } from "../controller/discovery_controller.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/search", searchAll);
router.get("/discover/trending", getTrendingPosts);
router.get("/discover/authors", optionalAuth, getPopularAuthors);

export default router;
