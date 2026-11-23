import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect, disconnect, resetDb, makeUser, api, User, PASSWORD } from "./helpers.js";
import { setTransporter } from "../services/emailService.js";

const outbox = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The reply is sent before the email is handed to the transport, so wait for it to arrive.
const waitForEmail = async () => {
    for (let i = 0; i < 100 && outbox.length === 0; i += 1) await sleep(10);
    return outbox[outbox.length - 1];
};
const tokenFrom = (message) => message.text.match(/\/reset-password\/([a-f0-9]{64})/)?.[1];
const storedReset = (id) => User.findById(id).select("+passwordResetToken +passwordResetExpires");
const requestReset = (email) => api().post("/api/forgot-password").send({ email });
const login = (email, password) => api().post("/api/login").send({ email, password });

before(async () => {
    await connect();
    setTransporter({ sendMail: async (message) => { outbox.push(message); } });
});
after(disconnect);
beforeEach(async () => {
    await resetDb();
    outbox.length = 0;
});

describe("POST /api/forgot-password", () => {
    it("emails a reset link and stores only the hash of its token", async () => {
        const { user } = await makeUser("user");
        const res = await requestReset(user.email);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);

        const message = await waitForEmail();
        assert.ok(message, "an email was sent");
        assert.equal(message.to, user.email);
        const token = tokenFrom(message);
        assert.ok(token, "the email contains a reset link");
        assert.match(message.text, /\/reset-password\//);
        assert.doesNotMatch(message.text, /\/admin\/reset-password\//);

        const stored = await storedReset(user._id);
        assert.equal(stored.passwordResetToken, sha256(token));
        assert.notEqual(stored.passwordResetToken, token, "the raw token is never stored");
        const minutes = (stored.passwordResetExpires.getTime() - Date.now()) / 60000;
        assert.ok(minutes > 14 && minutes <= 15, `normal users get 15 minutes (got ${minutes.toFixed(1)})`);
    });

    it("matches the email case-insensitively", async () => {
        const { user } = await makeUser("user");
        const res = await requestReset(`  ${user.email.toUpperCase()}  `);
        assert.equal(res.status, 200);
        assert.ok(await waitForEmail());
    });

    for (const role of ["admin", "superadmin", "moderator"]) {
        it(`sends ${role} accounts a shorter-lived link into the admin console`, async () => {
            const { user } = await makeUser(role);
            await requestReset(user.email);
            const message = await waitForEmail();
            assert.ok(message, "an email was sent");
            assert.match(message.text, /\/admin\/reset-password\/[a-f0-9]{64}/);
            const stored = await storedReset(user._id);
            const minutes = (stored.passwordResetExpires.getTime() - Date.now()) / 60000;
            assert.ok(minutes > 9 && minutes <= 10, `staff get 10 minutes (got ${minutes.toFixed(1)})`);
        });
    }

    it("answers identically for an unknown email and sends nothing", async () => {
        const { user } = await makeUser("user");
        const known = await requestReset(user.email);
        outbox.length = 0;
        const unknown = await requestReset("nobody@example.test");
        assert.equal(unknown.status, known.status);
        assert.deepEqual(unknown.body, known.body);
        await sleep(50);
        assert.equal(outbox.length, 0);
    });

    it("sends nothing for a deactivated account", async () => {
        const { user } = await makeUser("user", { isDeleted: true, deletedAt: new Date() });
        const res = await requestReset(user.email);
        assert.equal(res.status, 200);
        await sleep(50);
        assert.equal(outbox.length, 0);
        const stored = await User.findById(user._id).setOptions({ withDeleted: true }).select("+passwordResetToken");
        assert.equal(stored.passwordResetToken, null);
    });

    it("rejects a malformed or missing email", async () => {
        assert.equal((await requestReset("not-an-email")).status, 400);
        assert.equal((await requestReset(undefined)).status, 400);
        assert.equal((await requestReset({ $ne: "" })).status, 400, "operator objects are not treated as an email");
    });

    it("a newer request invalidates the previous link", async () => {
        const { user } = await makeUser("user");
        await requestReset(user.email);
        const first = tokenFrom(await waitForEmail());
        outbox.length = 0;
        await requestReset(user.email);
        const second = tokenFrom(await waitForEmail());
        assert.notEqual(first, second);

        const stale = await api().post(`/api/reset-password/${first}`).send({ password: "Another-password-9" });
        assert.equal(stale.status, 400);
        const fresh = await api().post(`/api/reset-password/${second}`).send({ password: "Another-password-9" });
        assert.equal(fresh.status, 200);
    });

    it("never exposes the reset fields through normal reads", async () => {
        const { user } = await makeUser("user");
        await requestReset(user.email);
        await waitForEmail();
        const plain = await User.findById(user._id);
        assert.equal(plain.passwordResetToken, undefined);
        assert.equal(plain.passwordResetExpires, undefined);
        assert.equal(plain.toJSON().passwordResetToken, undefined);
    });
});

describe("POST /api/reset-password/:token", () => {
    const issueToken = async (user) => {
        await requestReset(user.email);
        const token = tokenFrom(await waitForEmail());
        outbox.length = 0;
        return token;
    };

    it("changes the password, consumes the token and ends existing sessions", async () => {
        const { user } = await makeUser("user");
        const session = await login(user.email, PASSWORD);
        assert.equal(session.status, 200);
        assert.ok((await User.findById(user._id)).refreshToken, "a session exists before the reset");

        const token = await issueToken(user);
        const newPassword = "Brand-new-password-1";
        const res = await api().post(`/api/reset-password/${token}`).send({ password: newPassword });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.success, true);

        assert.equal((await login(user.email, PASSWORD)).status, 401, "old password stops working");
        assert.equal((await login(user.email, newPassword)).status, 200, "new password works");

        const after = await storedReset(user._id);
        assert.equal(after.passwordResetToken, null);
        assert.equal(after.passwordResetExpires, null);
        assert.notEqual(after.password, newPassword, "the password is stored hashed");
    });

    it("signs out sessions started with the old password", async () => {
        const { user } = await makeUser("user");
        const session = await login(user.email, PASSWORD);
        const cookie = session.headers["set-cookie"];
        const token = await issueToken(user);
        await api().post(`/api/reset-password/${token}`).send({ password: "Brand-new-password-1" });

        const refresh = await api().post("/api/refresh").set("Cookie", cookie);
        assert.equal(refresh.status, 403, "the old refresh token no longer works");
    });

    it("works for an admin account", async () => {
        const { user } = await makeUser("admin");
        const token = await issueToken(user);
        const res = await api().post(`/api/reset-password/${token}`).send({ password: "Admin-new-password-1" });
        assert.equal(res.status, 200);
        const next = await login(user.email, "Admin-new-password-1");
        assert.equal(next.status, 200);
        assert.equal(next.body.data.user.role, "admin");
    });

    it("can only be used once", async () => {
        const { user } = await makeUser("user");
        const token = await issueToken(user);
        const first = await api().post(`/api/reset-password/${token}`).send({ password: "Brand-new-password-1" });
        assert.equal(first.status, 200);
        const second = await api().post(`/api/reset-password/${token}`).send({ password: "Someone-elses-pass-2" });
        assert.equal(second.status, 400);
        assert.equal((await login(user.email, "Brand-new-password-1")).status, 200, "the first password stands");
    });

    it("rejects concurrent use: exactly one request wins", async () => {
        const { user } = await makeUser("user");
        const token = await issueToken(user);
        const results = await Promise.all(
            ["Concurrent-pass-one-1", "Concurrent-pass-two-2"].map((password) =>
                api().post(`/api/reset-password/${token}`).send({ password }))
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    });

    it("rejects an expired token", async () => {
        const { user } = await makeUser("user");
        const token = await issueToken(user);
        await User.updateOne({ _id: user._id }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
        const res = await api().post(`/api/reset-password/${token}`).send({ password: "Brand-new-password-1" });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /invalid or has expired/i);
        assert.equal((await login(user.email, PASSWORD)).status, 200, "the old password is untouched");
    });

    it("rejects unknown and malformed tokens", async () => {
        await makeUser("user");
        const unknown = await api().post(`/api/reset-password/${"a".repeat(64)}`).send({ password: "Brand-new-password-1" });
        assert.equal(unknown.status, 400);
        const malformed = await api().post("/api/reset-password/not-a-token").send({ password: "Brand-new-password-1" });
        assert.equal(malformed.status, 400);
    });

    it("rejects a weak or missing password without consuming the token", async () => {
        const { user } = await makeUser("user");
        const token = await issueToken(user);
        assert.equal((await api().post(`/api/reset-password/${token}`).send({ password: "short" })).status, 400);
        assert.equal((await api().post(`/api/reset-password/${token}`).send({})).status, 400);
        assert.equal((await api().post(`/api/reset-password/${token}`).send({ password: "x".repeat(129) })).status, 400);
        const ok = await api().post(`/api/reset-password/${token}`).send({ password: "Brand-new-password-1" });
        assert.equal(ok.status, 200, "the link still works after a rejected password");
    });

    it("cannot reset a deactivated account", async () => {
        const { user } = await makeUser("user");
        const token = await issueToken(user);
        await User.updateOne({ _id: user._id }, { $set: { isDeleted: true, deletedAt: new Date() } });
        const res = await api().post(`/api/reset-password/${token}`).send({ password: "Brand-new-password-1" });
        assert.equal(res.status, 400);
    });
});

describe("rate limiting", () => {
    it("limits reset requests per email address", async () => {
        const { user } = await makeUser("user");
        process.env.RATE_LIMIT_ENABLED = "true";
        try {
            const statuses = [];
            for (let i = 0; i < 4; i += 1) statuses.push((await requestReset(user.email)).status);
            assert.deepEqual(statuses, [200, 200, 200, 429]);
        } finally {
            delete process.env.RATE_LIMIT_ENABLED;
        }
    });
});
