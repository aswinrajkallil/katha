// Vercel preview deployments get a new URL on every deploy, e.g.
// https://katha-9xnxnub9w-aswinrajkallils-projects.vercel.app
// Allow only this project's previews, not every *.vercel.app site.
const VERCEL_PREVIEW_PATTERN = /^https:\/\/katha-[a-z0-9]+-aswinrajkallils-projects\.vercel\.app$/;

export const isAllowedOrigin = (origin, allowedOrigins) =>
    !origin || allowedOrigins.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin);
