import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import { getFollowingFeed } from "../controller/feed_controller.js";

const router = express.Router();
router.get("/following", authenticate, getFollowingFeed);
export default router;
