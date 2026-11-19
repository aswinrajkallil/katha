import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { isAllowedOrigin } from "./config/cors.js";

let ioInstance = null;

export const initSocket = (httpServer, allowedOrigins) => {
    const io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => callback(null, isAllowedOrigin(origin, allowedOrigins)),
            credentials: true,
        }
    });

    io.use((socket, next) => {
        const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        const token = rawToken?.replace(/^Bearer\s+/i, "");

        if (token && process.env.JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.user = decoded;
            } catch {
                // Allow guest connection
                socket.user = null;
            }
        } else {
            socket.user = null;
        }
        next();
    });

    io.on("connection", (socket) => {
        if (socket.user?.id) {
            socket.join(`user:${socket.user.id}`);
        }

        socket.on("authenticate", (token) => {
            if (token && process.env.JWT_SECRET) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    socket.user = decoded;
                    socket.join(`user:${decoded.id}`);
                } catch {
                    // Ignore invalid token
                }
            }
        });

        socket.on("join:post", (postId) => {
            if (postId) socket.join(`post:${postId}`);
        });

        socket.on("leave:post", (postId) => {
            if (postId) socket.leave(`post:${postId}`);
        });

        socket.on("join:user", (userId) => {
            if (userId) socket.join(`user:${userId}`);
        });

        socket.on("leave:user", (userId) => {
            if (userId && (!socket.user || socket.user.id !== userId)) {
                socket.leave(`user:${userId}`);
            }
        });
    });

    ioInstance = io;
    return io;
};

export const getIO = () => ioInstance;

export const emitToRoom = (room, event, data) => {
    if (ioInstance && room) ioInstance.to(room).emit(event, data);
};

export const emitToAll = (event, data) => {
    if (ioInstance) ioInstance.emit(event, data);
};
