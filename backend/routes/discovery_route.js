import express from "express";
import { searchAll, getTrendingPosts, getPopularAuthors } from "../controller/discovery_controller.js";

const router = express.Router();
router.get("/search", searchAll);
router.get("/discover/trending", getTrendingPosts);
router.get("/discover/authors", getPopularAuthors);
export default router;
