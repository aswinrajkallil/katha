/**
 * Creates an Image element from a URL or data URI.
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

/**
 * Crops and compresses an image on a client-side HTML canvas.
 * Produces a high-quality WebP or JPEG Blob under target dimensions.
 *
 * @param {string} imageSrc Source image URL or Object URL
 * @param {object} pixelCrop Crop coordinates from react-easy-crop { x, y, width, height }
 * @param {number} [targetWidth=512] Output max width
 * @param {number} [targetHeight=512] Output max height
 * @param {number} [quality=0.85] Compression quality
 * @param {string} [filename="image.webp"] File name
 * @returns {Promise<{ file: File, previewUrl: string }>}
 */
export async function getCroppedImg(
  imageSrc,
  pixelCrop,
  targetWidth = 512,
  targetHeight = 512,
  quality = 0.85,
  filename = "cropped.webp"
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context is unavailable");
  }

  // Set target canvas dimensions
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Improve image smoothing for downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped slice scaled into target dimensions
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    // Prefer WebP for superior compression, fallback to JPEG
    const mimeType = "image/webp";

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas export produced an empty blob"));
          return;
        }
        const file = new File([blob], filename, { type: blob.type || mimeType });
        const previewUrl = URL.createObjectURL(blob);
        resolve({ file, previewUrl });
      },
      mimeType,
      quality
    );
  });
}

export default getCroppedImg;
