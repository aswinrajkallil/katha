
import cloudinary from "../config/cloudinary.js";

const uploadToCloudinary = (fileBuffer, folder = "katha") => {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            const error = new Error("Cloudinary configuration missing on server (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
            error.code = "CLOUDINARY_CONFIG_MISSING";
            console.error("Cloudinary upload error:", error.message);
            return reject(error);
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image"
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary uploader failed:", error);
                    return reject(error);
                }

                resolve({
                    url: result.secure_url,
                    publicId: result.public_id 
                });
            }
        );

        uploadStream.end(fileBuffer);
    });
};

export default uploadToCloudinary;
