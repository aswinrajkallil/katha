import mongoose from "mongoose";

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured in the environment");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Mongo DB Connected Successfully !!");
    } catch (error) {
        console.error("Failed to connect MongoDB:", error.message);
        throw error;
    }
};

export default connectDB;
