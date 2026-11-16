const API_URL = import.meta.env.VITE_API_URL || "";

/**
 * Normalizes and optimizes media URLs.
 * - Handles null/undefined/empty input gracefully.
 * - data: and blob: URLs returned untouched.
 * - For res.cloudinary.com URLs, injects f_auto,q_auto and width/height/fit crop transforms.
 * - Other absolute URLs (http://, https://) returned untouched.
 * - Relative URLs (/uploads/...) prefixed with API_URL without duplicate slashes.
 *
 * @param {string|null} src The source URL or path
 * @param {object} [options]
 * @param {number} [options.w] Desired width in pixels
 * @param {number} [options.h] Desired height in pixels
 * @param {string} [options.fit] Cloudinary crop mode ('fill', 'scale', 'fit', 'limit', 'thumb', etc.)
 * @returns {string} The normalized, transformed media URL
 */
export function mediaUrl(src, options = {}) {
  if (!src || typeof src !== "string") return "";

  const trimmed = src.trim();
  if (!trimmed) return "";

  // Data URLs or local Blob previews
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // Cloudinary delivery URLs
  if (trimmed.includes("res.cloudinary.com")) {
    const { w, h, fit } = options;
    const transformParts = ["f_auto", "q_auto"];
    if (w) transformParts.push(`w_${Math.round(w)}`);
    if (h) transformParts.push(`h_${Math.round(h)}`);
    if (fit) {
      transformParts.push(`c_${fit}`);
    } else if (w && h) {
      transformParts.push("c_fill");
    }

    const transformStr = transformParts.join(",");

    const uploadIndex = trimmed.indexOf("/upload/");
    if (uploadIndex !== -1) {
      const before = trimmed.slice(0, uploadIndex + 8);
      const after = trimmed.slice(uploadIndex + 8);

      // Do not duplicate transformations if already present
      if (after.startsWith("f_auto") || after.startsWith("q_auto")) {
        return trimmed;
      }
      return `${before}${transformStr}/${after}`;
    }
    return trimmed;
  }

  // Other absolute URLs
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Relative URLs
  const cleanBase = API_URL.replace(/\/+$/, "");
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}

export default mediaUrl;
