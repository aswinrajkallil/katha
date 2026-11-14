import Notification from "../models/Notification.js";
import mongoose from "mongoose";

const listNotifications = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const filter = { recipient: req.user.id };
        const [notifications, total, unread] = await Promise.all([
            Notification.find(filter).populate("sender", "username fullName profileImage")
                .populate("post", "title slug").populate("comment", "content")
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Notification.countDocuments(filter),
            Notification.countDocuments({ ...filter, isRead: false })
        ]);
        return res.json({ success: true, data: { notifications, unread, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
        console.error("listNotifications:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch notifications" });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid notification ID" });
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id }, { isRead: true }, { new: true }
        );
        if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
        return res.json({ success: true, data: notification });
    } catch (error) { return res.status(500).json({ success: false, message: "Unable to update notification" }); }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user.id, isRead: false }, { $set: { isRead: true } });
        return res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) { return res.status(500).json({ success: false, message: "Unable to update notifications" }); }
};

const deleteNotification = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid notification ID" });
        const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        if (!deleted) return res.status(404).json({ success: false, message: "Notification not found" });
        return res.json({ success: true, message: "Notification deleted" });
    } catch (error) { return res.status(500).json({ success: false, message: "Unable to delete notification" }); }
};

export { listNotifications, markNotificationRead, markAllRead, deleteNotification };
