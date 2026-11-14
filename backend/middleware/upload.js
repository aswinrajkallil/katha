import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Never trust original filename — use timestamp + random suffix
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isAllowed =
        allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
        allowedTypes.test(file.mimetype);

    if (isAllowed) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

export default upload;
