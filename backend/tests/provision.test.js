import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { connect, disconnect, resetDb, makeUser, User, AdminAuditLog } from "./helpers.js";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "provisionSuperAdmin.js");
const uri = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27099/katha_test";

const run = (...args) =>
    new Promise((resolve) => {
        execFile("node", [script, ...args], { env: { ...process.env, MONGO_URI: uri, NODE_ENV: "test" } }, (error, stdout, stderr) =>
            resolve({ code: error ? error.code : 0, out: `${stdout}${stderr}` })
        );
    });

before(connect);
after(disconnect);
beforeEach(resetDb);

describe("Super Admin provisioning script", () => {
    it("does nothing without --apply (dry run)", async () => {
        const { user } = await makeUser("user");
        const res = await run("--email", user.email);
        assert.equal(res.code, 0);
        assert.match(res.out, /DRY RUN/);
        assert.equal((await User.findById(user._id)).role, "user");
    });

    it("promotes exactly the named account, audits it, and does not touch existing admins", async () => {
        const { user } = await makeUser("user");
        const admin = await makeUser("admin");
        const res = await run("--email", user.email, "--apply");
        assert.equal(res.code, 0, res.out);
        assert.equal((await User.findById(user._id)).role, "superadmin");
        assert.equal((await User.findById(admin.id)).role, "admin", "existing admins are not promoted");
        const log = await AdminAuditLog.findOne({ action: "role.provision_superadmin" });
        assert.equal(log.actorRole, "system");
        assert.equal(log.targetId.toString(), user._id.toString());
    });

    it("is idempotent for an existing Super Admin", async () => {
        const { user } = await makeUser("superadmin");
        const res = await run("--email", user.email, "--apply");
        assert.equal(res.code, 0);
        assert.match(res.out, /already a Super Admin/);
        assert.equal(await AdminAuditLog.countDocuments(), 0);
    });

    it("refuses to add a second Super Admin unless explicitly allowed", async () => {
        await makeUser("superadmin");
        const { user } = await makeUser("user");
        let res = await run("--email", user.email, "--apply");
        assert.notEqual(res.code, 0);
        assert.equal((await User.findById(user._id)).role, "user");
        res = await run("--email", user.email, "--apply", "--allow-additional");
        assert.equal(res.code, 0, res.out);
        assert.equal((await User.findById(user._id)).role, "superadmin");
    });

    it("fails for unknown, deactivated or malformed emails and never creates an account", async () => {
        const gone = await makeUser("user");
        await User.updateOne({ _id: gone.id }, { isDeleted: true, deletedAt: new Date() });
        assert.notEqual((await run("--email", "nobody@example.test", "--apply")).code, 0);
        assert.notEqual((await run("--email", gone.user.email, "--apply")).code, 0);
        assert.notEqual((await run("--email", "not-an-email", "--apply")).code, 0);
        assert.notEqual((await run("--apply")).code, 0);
        assert.equal(await User.countDocuments({ role: "superadmin" }), 0);
    });

    it("the retired createAdmin script refuses to run", async () => {
        const retired = path.join(path.dirname(script), "createAdmin.js");
        const res = await new Promise((resolve) => execFile("node", [retired, "a@b.c"], (e) => resolve(e?.code ?? 0)));
        assert.notEqual(res, 0);
    });
});
