import express from "express";
import {
    getUserProfile,
    getMyProfile,
    updateProfile,
    updateCoverImage,
    getUserPosts,
    getSuggestedUsers
} from "../controller/user_controller.js";
import { followUser, unfollowUser, getFollowers, getFollowing, getFollowStatus } from "../controller/follow_controller.js";
import authenticate, { optionalAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import validateImage from "../middleware/validateImage.js";

const router = express.Router();

router.get("/profile", authenticate, getMyProfile);
router.put("/profile", authenticate, upload.fields([{ name: "profileImage", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]), validateImage, updateProfile);
router.put("/profile/cover", authenticate, upload.single("coverImage"), validateImage, updateCoverImage);
router.get("/suggestions", authenticate, getSuggestedUsers);
router.get("/:id/posts", getUserPosts);
router.get("/:userId/follow-status", authenticate, getFollowStatus);
router.post("/:userId/follow", authenticate, followUser);
router.delete("/:userId/follow", authenticate, unfollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);
router.get("/:id", optionalAuth, getUserProfile);

export default router;
