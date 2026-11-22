import mongoose from "mongoose";

// MongoDB multi-document transactions only work on a replica set or a sharded cluster. A
// standalone mongod (typical for local development) rejects them. We detect the topology once
// and fall back to running the work without a session, so callers write the same code for both.

let cached = null;

export const transactionsSupported = async () => {
    if (cached !== null) return cached;
    try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        cached = Boolean(hello.setName) || hello.msg === "isdbgrid";
    } catch {
        cached = false;
    }
    return cached;
};

export const resetTransactionSupportCache = () => {
    cached = null;
};

/**
 * Run `work(session)` atomically when the deployment supports transactions; otherwise run it with
 * `session = null`. `work` may be retried by the driver on transient errors, so it must only touch
 * the database through the session it is given (and must not trigger external side effects such
 * as Cloudinary deletes or socket emits - do those after this resolves).
 */
export const runAtomic = async (work) => {
    if (!(await transactionsSupported())) return work(null);
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};
