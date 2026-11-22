import http from "http";
import dotenv from "dotenv";

import connectDB from "./db/connectDB.js";
import { initSocket } from "./socket.js";

dotenv.config();
const { default: app, allowedOrigins } = await import("./app.js");
const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const io = initSocket(httpServer, allowedOrigins);
app.set("io", io);

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be configured");
        await connectDB();
        httpServer.listen(PORT, () => console.log(`Kathā API running on http://localhost:${PORT}`));
    } catch (error) {
        console.error("Failed to start API:", error);
        process.exit(1);
    }
};
startServer();
