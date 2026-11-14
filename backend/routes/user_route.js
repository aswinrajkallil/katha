import express from "express";
import { getUserProfile, updateProfile } from "../controller/user_controller.js";
import { followUser, unfollowUser, getFollowers, getFollowing } from "../controller/follow_controller.js";
import authenticate from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.get("/profile", authenticate, getUserProfile);
router.put("/profile", authenticate, upload.single("profileImage"), updateProfile);
router.get("/:id", getUserProfile);
router.post("/:userId/follow", authenticate, followUser);
router.delete("/:userId/follow", authenticate, unfollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export default router;
