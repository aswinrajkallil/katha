import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

// Strict DB-backed admin check that queries MongoDB on every request (does not trust JWT payload)
const requireAdminDb = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        const user = await User.findById(req.user.id).select("role username email");
        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }
        req.adminUser = user;
        next();
    } catch (error) {
        console.error("requireAdminDb error:", error);
        return res.status(500).json({
            success: false,
            message: "Authorization check failed"
        });
    }
};

export { authenticate, optionalAuth, requireAdmin, requireAdminDb };
export default authenticate;
