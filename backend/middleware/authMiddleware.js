import jwt from "jsonwebtoken";

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach decoded user payload to request
        req.user = decoded;

        next();
    } catch (e) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

// Optional auth: attaches user if token is present, but doesn't block if missing
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        }
    } catch (_) {
        // Token invalid — treat as unauthenticated, don't block
    }
    next();
};

// Middleware to restrict access to admins only
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required"
        });
    }
    next();
};

export { authenticate, optionalAuth, requireAdmin };
export default authenticate;
