import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/connectDB.js";
import User from "../models/User.js";

dotenv.config();

const emailArg = process.argv[2];

if (!emailArg) {
    console.error("Error: Email argument is required.");
    console.error("Usage: node backend/scripts/createAdmin.js <email>");
    process.exit(1);
}

const promoteUser = async () => {
    try {
        await connectDB();
        const email = emailArg.trim().toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email "${email}" not found.`);
            await mongoose.disconnect();
            process.exit(1);
        }

        if (user.role === "admin") {
            console.log(`User ${email} (@${user.username}) is already an admin.`);
            await mongoose.disconnect();
            process.exit(0);
        }

        user.role = "admin";
        await user.save();
        console.log(`Successfully promoted ${email} (@${user.username}) to admin.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("Failed to promote user to admin:", err.message);
        try {
            await mongoose.disconnect();
        } catch (_) {}
        process.exit(1);
    }
};

promoteUser();
