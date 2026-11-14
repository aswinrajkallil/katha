import Category from "../models/Category.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        return res.status(200).json({
            success: true,
            message: "Categories fetched",
            data: categories
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// GET /api/categories/:id
const getCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const query = isValidId(id) ? { _id: id } : { slug: id };
        const category = await Category.findOne(query);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        return res.status(200).json({ success: true, message: "Category fetched", data: category });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// POST /api/categories — Admin only
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }
        const category = await Category.create({ name, description });
        return res.status(201).json({
            success: true,
            message: "Category created",
            data: category
        });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({ success: false, message: "Category already exists" });
        }
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// PUT /api/categories/:id — Admin only
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }
        const { name, description } = req.body;
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        if (name) category.name = name;
        if (description !== undefined) category.description = description;
        await category.save();
        return res.status(200).json({
            success: true,
            message: "Category updated",
            data: category
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

// DELETE /api/categories/:id — Admin only
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }

        // Check if any posts use this category
        const postsUsing = await Post.countDocuments({ category: id });
        if (postsUsing > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete — ${postsUsing} post(s) are using this category. Reassign or remove them first.`
            });
        }

        await Category.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: "Category deleted" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
