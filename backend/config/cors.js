const VERCEL_PREVIEW_ORIGIN = /^https:\/\/katha-[a-z0-9-]+-aswinrajkallils-projects\.vercel\.app$/i;

export const isAllowedOrigin = (origin, allowedOrigins = []) => {
    if (!origin) return true;

    const normalizedOrigin = origin.replace(/\/$/, "");
    return allowedOrigins.includes(normalizedOrigin) ||
        VERCEL_PREVIEW_ORIGIN.test(normalizedOrigin);
};
