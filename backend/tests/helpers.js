// Shared setup for the backend test suite.
//
// SAFETY: tests wipe collections. The suite refuses to run unless the database name contains
// "test", so pointing TEST_MONGO_URI (or MONGO_URI) at a real database aborts instead of wiping it.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-access-secret-not-for-production";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-not-for-production";
process.env.FRONTEND_URL ||= "http://localhost:5173";

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";

const uri = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27099/katha_test";
const dbName = new URL(uri).pathname.replace(/^\//, "");
if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
}

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: Post } = await import("../models/Post.js");
const { default: Comment } = await import("../models/Comment.js");
const { default: Category } = await import("../models/Category.js");
const { generateToken } = await import("../utils/jwt.js");
const { resetTransactionSupportCache, transactionsSupported } = await import("../utils/transaction.js");

export { app, User, Post, Comment, request, mongoose };
export { default as Report } from "../models/Report.js";
export { default as AdminAuditLog } from "../models/AdminAuditLog.js";
export { default as Notification } from "../models/Notification.js";
export { default as Like } from "../models/Like.js";
export { default as Bookmark } from "../models/Bookmark.js";
export { default as Follow } from "../models/Follow.js";
export { default as PostRevision } from "../models/PostRevision.js";
export { default as Category } from "../models/Category.js";
export { transactionsSupported };

let passwordHash;
export const PASSWORD = "Test-password-123";

export const connect = async () => {
    await mongoose.connect(uri);
    resetTransactionSupportCache();
    passwordHash = await bcrypt.hash(PASSWORD, 4);
    // Make sure unique indexes exist before tests rely on them
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
};

export const resetDb = async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
        await collection.deleteMany({});
    }
};

export const disconnect = async () => {
    await mongoose.disconnect();
};

let counter = 0;
export const makeUser = async (role = "user", overrides = {}) => {
    counter += 1;
    const username = overrides.username || `${role}${counter}`;
    const user = await User.create({
        username,
        email: `${username}@example.test`,
        password: passwordHash,
        role,
        ...overrides
    });
    return { user, token: generateToken(user), id: user._id.toString() };
};

export const makePost = async (author, overrides = {}) =>
    Post.create({ title: `Post ${++counter}`, content: "Some body text", excerpt: "excerpt", status: "published", author: author._id || author, ...overrides });

export const makeCategory = (name = `Category ${++counter}`) => Category.create({ name });

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
export const api = () => request(app);
export const as = (token) => ({
    get: (url) => request(app).get(url).set(auth(token)),
    post: (url, body) => request(app).post(url).set(auth(token)).send(body),
    put: (url, body) => request(app).put(url).set(auth(token)).send(body),
    patch: (url, body) => request(app).patch(url).set(auth(token)).send(body),
    delete: (url, body) => request(app).delete(url).set(auth(token)).send(body)
});
