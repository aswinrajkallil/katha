import fs from "fs/promises";

const signatures = [
    { mime: "image/jpeg", test: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: "image/png", test: b => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
    { mime: "image/gif", test: b => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString()) },
    { mime: "image/webp", test: b => b.length >= 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" }
];

const validateImage = async (req, res, next) => {
    if (!req.file) return next();
    try {
        const handle = await fs.open(req.file.path, "r");
        const buffer = Buffer.alloc(16);
        const { bytesRead } = await handle.read(buffer, 0, 16, 0);
        await handle.close();
        const valid = signatures.some(item => item.mime === req.file.mimetype && item.test(buffer.subarray(0, bytesRead)));
        if (!valid) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ success: false, message: "Uploaded file content does not match a supported image format" });
        }
        next();
    } catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ success: false, message: "Unable to validate uploaded image" });
    }
};
export default validateImage;
