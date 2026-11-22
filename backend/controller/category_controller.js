import Category from "../models/Category.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";
import { recordAudit, AUDIT_ACTIONS } from "../services/auditService.js";
import { runAtomic } from "../utils/transaction.js";
import { HttpError, handle } from "../utils/httpError.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const usageCounts = async (ids) => {
    const rows = await Post.aggregate([
        { $match: { category: { $in: ids } } },
        { $group: { _id: "$category", count: { $sum: 1 } } }
    ]).option({ withDeleted: true });
    return new Map(rows.map((r) => [r._id.toString(), r.count]));
};

// GET /api/categories  (?withCounts=true adds postsCount; the default response is unchanged)
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 }).lean();
        let data = categories;
        if (req.query.withCounts === "true") {
            const counts = await usageCounts(categories.map((c) => c._id));
            data = categories.map((c) => ({ ...c, postsCount: counts.get(c._id.toString()) || 0 }));
        }
        return res.status(200).json({ success: true, message: "Categories fetched", data });
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

const cleanName = (value) => {
    if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "Category name is required");
    const name = value.trim().replace(/\s+/g, " ");
    if (name.length > 50) throw new HttpError(400, "Category name must be at most 50 characters");
    return name;
};
const cleanDescription = (value) => {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string" || value.length > 300) throw new HttpError(400, "Description must be at most 300 characters");
    return value.trim();
};

// Case-insensitive duplicate check on top of the unique index
const assertNameFree = async (name, exceptId = null) => {
    const clash = await Category.findOne({
        name: new RegExp(`^${escapeRegex(name)}$`, "i"),
        ...(exceptId ? { _id: { $ne: exceptId } } : {})
    }).select("_id");
    if (clash) throw new HttpError(409, "Category already exists");
};

// POST /api/categories — Admin / Super Admin
const createCategory = handle(async (req, res) => {
    const name = cleanName(req.body?.name);
    const description = cleanDescription(req.body?.description);
    await assertNameFree(name);
    let category;
    try {
        category = await Category.create({ name, description });
    } catch (e) {
        if (e.code === 11000) throw new HttpError(409, "Category already exists");
        throw e;
    }
    await recordAudit(req.actor, { action: AUDIT_ACTIONS.CATEGORY_CREATE, targetType: "category", targetId: category._id, targetLabel: category.name });
    return res.status(201).json({ success: true, message: "Category created", data: category });
});

// PUT /api/categories/:id — Admin / Super Admin
const updateCategory = handle(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) throw new HttpError(400, "Invalid category ID");
    const category = await Category.findById(id);
    if (!category) throw new HttpError(404, "Category not found");

    const before = { name: category.name, description: category.description };
    if (req.body?.name !== undefined) {
        const name = cleanName(req.body.name);
        if (name !== category.name) await assertNameFree(name, category._id);
        category.name = name;
    }
    if (req.body?.description !== undefined) category.description = cleanDescription(req.body.description);

    try {
        await category.save();
    } catch (e) {
        if (e.code === 11000) throw new HttpError(409, "Category already exists");
        throw e;
    }
    await recordAudit(req.actor, {
        action: AUDIT_ACTIONS.CATEGORY_UPDATE,
        targetType: "category",
        targetId: category._id,
        targetLabel: category.name,
        metadata: { before, after: { name: category.name, description: category.description } }
    });
    return res.status(200).json({ success: true, message: "Category updated", data: category });
});

// DELETE /api/categories/:id[?reassignTo=<categoryId>|none] — Admin / Super Admin
//
// Unused categories delete immediately. A category with posts is refused (the original behaviour)
// unless the caller says what to do with them: reassign to another category, or `none` to leave
// those posts uncategorised. Counts include soft-deleted posts so a later restore never points at
// a missing category.
const deleteCategory = handle(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) throw new HttpError(400, "Invalid category ID");
    const category = await Category.findById(id);
    if (!category) throw new HttpError(404, "Category not found");

    const postsUsing = await Post.countDocuments({ category: id }).setOptions({ withDeleted: true });
    const reassignTo = req.query.reassignTo;

    if (postsUsing > 0 && !reassignTo) {
        throw new HttpError(400, `Cannot delete — ${postsUsing} post(s) are using this category. Reassign them or choose to leave them uncategorised.`, { postsUsing });
    }

    let newCategory = null;
    if (postsUsing > 0 && reassignTo !== "none") {
        if (!isValidId(reassignTo) || String(reassignTo) === String(id)) throw new HttpError(400, "Invalid category to reassign to");
        newCategory = await Category.findById(reassignTo).select("name");
        if (!newCategory) throw new HttpError(400, "Category to reassign to was not found");
    }

    await runAtomic(async (session) => {
        if (postsUsing > 0) {
            await Post.updateMany({ category: id }, { $set: { category: newCategory ? newCategory._id : null } }, { session, withDeleted: true });
        }
        await Category.deleteOne({ _id: id }, { session });
        await recordAudit(
            req.actor,
            {
                action: AUDIT_ACTIONS.CATEGORY_DELETE,
                targetType: "category",
                targetId: category._id,
                targetLabel: category.name,
                metadata: { postsAffected: postsUsing, reassignedTo: newCategory ? newCategory.name : postsUsing ? "none" : undefined }
            },
            { session }
        );
    });
    return res.status(200).json({ success: true, message: "Category deleted", postsAffected: postsUsing });
});

export { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
