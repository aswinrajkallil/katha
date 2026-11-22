// Lightweight per-process limiter. Use a shared store (e.g. Redis) for multi-instance production deployments.
//
// Every limiter owns its own buckets. Previously all limiters shared one map keyed only by IP, so
// a login attempt also consumed the admin limiter's budget (and vice versa).
//
// `keyGenerator` lets a limiter count per authenticated user instead of per IP, which stops one
// account from flooding an endpoint while spreading requests over many IPs.
const rateLimit = ({
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = "Too many requests. Please try again later.",
    keyGenerator = null
} = {}) => {
    const buckets = new Map();

    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets) {
            if (now >= bucket.resetAt) buckets.delete(key);
        }
    }, Math.max(windowMs, 60 * 1000));
    sweep.unref?.();

    return (req, res, next) => {
        // Automated tests make many requests from one address; opt back in with RATE_LIMIT_ENABLED=true.
        if (process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_ENABLED !== "true") return next();

        const key = (keyGenerator && keyGenerator(req)) || req.ip || req.socket.remoteAddress || "unknown";
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
