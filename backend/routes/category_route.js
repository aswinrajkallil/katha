import express from "express";
import {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controller/category_controller.js";
import authenticate, { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategory);
router.post("/", authenticate, requireAdmin, createCategory);
router.put("/:id", authenticate, requireAdmin, updateCategory);
router.delete("/:id", authenticate, requireAdmin, deleteCategory);

export default router;
