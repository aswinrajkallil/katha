const buckets = new Map();

// Lightweight per-process limiter. Use a shared store (e.g. Redis) for multi-instance production deployments.
const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests. Please try again later." } = {}) => {
    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || now >= bucket.resetAt) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        res.setHeader("RateLimit-Limit", String(max));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
        res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > max) return res.status(429).json({ success: false, message });
        next();
    };
};
export default rateLimit;
