import fs from "fs/promises";

const signatures = [
    { mime: "image/jpeg", test: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: "image/png", test: b => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { mime: "image/gif", test: b => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString()) },
    { mime: "image/webp", test: b => b.length >= 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" }
];

const validateImage = async (req, res, next) => {
    const files = [];
    if (req.file) {
        files.push(req.file);
    } else if (req.files) {
        if (Array.isArray(req.files)) {
            files.push(...req.files);
        } else if (typeof req.files === "object") {
            Object.values(req.files).forEach((fList) => {
                if (Array.isArray(fList)) files.push(...fList);
                else if (fList) files.push(fList);
            });
        }
    }

    if (!files.length) return next();

    try {
        for (const file of files) {
            let header;
            if (file.buffer) {
                header = file.buffer.subarray(0, 16);
            } else if (file.path) {
                const handle = await fs.open(file.path, "r");
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

            const valid = signatures.some(item => item.mime === file.mimetype && item.test(header));
            if (!valid) {
                if (file.path) {
                    await fs.unlink(file.path).catch(() => {});
                }
                return res.status(400).json({
                    success: false,
                    message: "Uploaded file content does not match a supported image format",
                    errorType: "INVALID_IMAGE_SIGNATURE"
                });
            }
        }
        next();
    } catch (error) {
        console.error("validateImage error:", error);
        for (const file of files) {
            if (file?.path) {
                await fs.unlink(file.path).catch(() => {});
            }
        }
        return res.status(400).json({
            success: false,
            message: "Unable to validate uploaded image",
            errorType: "VALIDATION_ERROR"
        });
    }
};

export default validateImage;
