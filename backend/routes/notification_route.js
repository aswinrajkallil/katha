import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
    listNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllRead,
    deleteNotification
} from "../controller/notification_controller.js";

const router = express.Router();
router.use(authenticate);
router.get("/unread-count", getUnreadCount);
router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);
export default router;
