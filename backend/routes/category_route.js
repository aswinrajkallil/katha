import express from "express";
import {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controller/category_controller.js";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// Writes use database-backed authorization (same as /api/admin), so a demoted admin loses
// category access immediately instead of when their JWT expires. Moderators are not allowed.
const manage = [authenticate, requirePermission("categories:manage")];

router.get("/", getCategories);
router.get("/:id", getCategory);
router.post("/", ...manage, createCategory);
router.put("/:id", ...manage, updateCategory);
router.delete("/:id", ...manage, deleteCategory);

export default router;
