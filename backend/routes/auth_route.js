import express from "express";
import { register, login, refreshAccessToken, logout, getMe } from "../controller/auth_controller.js";
import authenticate from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
