import fs from "fs/promises";

const signatures = [
    { mime: "image/jpeg", test: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: "image/png", test: b => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { mime: "image/gif", test: b => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString()) },
    { mime: "image/webp", test: b => b.length >= 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" }
];

const validateImage = async (req, res, next) => {
    if (!req.file) return next();
    try {
        let header;
        if (req.file.buffer) {
            header = req.file.buffer.subarray(0, 16);
        } else if (req.file.path) {
            const handle = await fs.open(req.file.path, "r");
            const buffer = Buffer.alloc(16);
            const { bytesRead } = await handle.read(buffer, 0, 16, 0);
            await handle.close();
            header = buffer.subarray(0, bytesRead);
        } else {
            return res.status(400).json({
                success: false,
                message: "No file content received for image validation",
                errorType: "EMPTY_FILE"
            });
        }

        const valid = signatures.some(item => item.mime === req.file.mimetype && item.test(header));
        if (!valid) {
            if (req.file.path) {
                await fs.unlink(req.file.path).catch(() => {});
            }
            return res.status(400).json({
                success: false,
                message: "Uploaded file content does not match a supported image format",
                errorType: "INVALID_IMAGE_SIGNATURE"
            });
        }
        next();
    } catch (error) {
        console.error("validateImage error:", error);
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        return res.status(400).json({
            success: false,
            message: "Unable to validate uploaded image",
            errorType: "VALIDATION_ERROR"
        });
    }
};

export default validateImage;
