import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            trim: true
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true
        },
        description: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Auto-generate slug from name before saving
// (No `next` callback: Mongoose 9 no longer passes one to synchronous hooks, so calling it threw
// "next is not a function" and made every category create/update fail.)
categorySchema.pre("save", function () {
    if (this.isModified("name") || this.isNew) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
});

const Category = mongoose.model("Category", categorySchema);

export default Category;
