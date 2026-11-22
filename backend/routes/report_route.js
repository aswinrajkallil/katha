import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import rateLimit from "../middleware/rateLimit.js";
import { createReport } from "../controller/report_controller.js";

const router = express.Router();

// Counted per account (falling back to IP), so one user cannot flood the queue from many addresses.
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "You are reporting too quickly. Please try again later.",
    keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : null)
});

router.post("/", authenticate, reportLimiter, createReport);

export default router;
