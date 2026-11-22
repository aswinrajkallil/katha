import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
    connect, disconnect, resetDb, makeUser, makePost, as, api, request, app,
    User, AdminAuditLog, PASSWORD
} from "./helpers.js";

before(connect);
after(disconnect);
beforeEach(resetDb);

describe("access control", () => {
    it("1. a normal user cannot reach admin APIs", async () => {
        const { token } = await makeUser("user");
        for (const path of ["/api/admin/stats", "/api/admin/users", "/api/admin/posts", "/api/admin/reports", "/api/admin/audit-logs", "/api/admin/comments"]) {
            const res = await as(token).get(path);
            assert.equal(res.status, 403, path);
        }
    });

    it("1b. unauthenticated requests are rejected", async () => {
        assert.equal((await api().get("/api/admin/stats")).status, 401);
    });

    it("2. a normal user cannot reach moderator-only actions", async () => {
        const { token } = await makeUser("user");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        const res = await as(token).delete(`/api/admin/posts/${post._id}`, { reason: "nope nope" });
        assert.equal(res.status, 403);
        const resolve = await as(token).post(`/api/admin/reports/${post._id}/resolve`, { outcome: "dismissed", resolution: "no" });
        assert.equal(resolve.status, 403);
    });

    it("3. a moderator cannot access Admin Management, settings or the dashboard", async () => {
        const { token } = await makeUser("moderator");
        assert.equal((await as(token).get("/api/admin/management/staff")).status, 403);
        assert.equal((await as(token).get("/api/admin/settings")).status, 403);
        assert.equal((await as(token).get("/api/admin/stats")).status, 403);
        assert.equal((await as(token).get("/api/admin/analytics")).status, 403);
        assert.equal((await as(token).get("/api/admin/users")).status, 403);
        const target = await makeUser("user");
        const res = await as(token).patch(`/api/admin/management/users/${target.id}/role`, { role: "admin", confirm: true });
        assert.equal(res.status, 403);
    });

    it("3b. a moderator can reach moderation endpoints but not admin-only post actions", async () => {
        const { token } = await makeUser("moderator");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        assert.equal((await as(token).get("/api/admin/posts")).status, 200);
        assert.equal((await as(token).get("/api/admin/reports")).status, 200);
        assert.equal((await as(token).get("/api/admin/comments")).status, 200);
        assert.equal((await as(token).patch(`/api/admin/posts/${post._id}`, { title: "x", reason: "because" })).status, 403);
        assert.equal((await as(token).patch(`/api/admin/posts/${post._id}/feature`, { featured: true })).status, 403);
        assert.equal((await as(token).patch(`/api/admin/posts/${post._id}/status`, { status: "draft", reason: "because" })).status, 403);
    });

    it("3c. admin-only management endpoints reject admins", async () => {
        const { token } = await makeUser("admin");
        assert.equal((await as(token).get("/api/admin/management/staff")).status, 403);
        assert.equal((await as(token).get("/api/admin/settings")).status, 403);
    });
});

describe("role management", () => {
    it("4. an admin cannot promote another user", async () => {
        const admin = await makeUser("admin");
        const target = await makeUser("user");
        for (const role of ["admin", "moderator"]) {
            const res = await as(admin.token).patch(`/api/admin/management/users/${target.id}/role`, { role, confirm: true });
            assert.equal(res.status, 403);
        }
        assert.equal((await User.findById(target.id)).role, "user");
    });

    it("5. an admin cannot demote another administrator", async () => {
        const admin = await makeUser("admin");
        const other = await makeUser("admin");
        const res = await as(admin.token).patch(`/api/admin/management/users/${other.id}/role`, { role: "user", confirm: true });
        assert.equal(res.status, 403);
        assert.equal((await User.findById(other.id)).role, "admin");
    });

    it("6. a super admin can promote a user to admin, and it is audited", async () => {
        const sa = await makeUser("superadmin");
        const target = await makeUser("user");
        const res = await as(sa.token).patch(`/api/admin/management/users/${target.id}/role`, { role: "admin", confirm: true, reason: "joined the team" });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const updated = await User.findById(target.id);
        assert.equal(updated.role, "admin");
        assert.ok(updated.roleChangedAt);
        assert.equal(updated.roleChangedBy.toString(), sa.id);
        const log = await AdminAuditLog.findOne({ action: "role.promote_admin" });
        assert.equal(log.actor.toString(), sa.id);
        assert.equal(log.actorRole, "superadmin");
        assert.equal(log.targetId.toString(), target.id);
    });

    it("7. a super admin can demote an admin", async () => {
        const sa = await makeUser("superadmin");
        const admin = await makeUser("admin");
        const res = await as(sa.token).patch(`/api/admin/management/users/${admin.id}/role`, { role: "user", confirm: true });
        assert.equal(res.status, 200);
        assert.equal((await User.findById(admin.id)).role, "user");
        assert.ok(await AdminAuditLog.findOne({ action: "role.demote_admin" }));
    });

    it("8. a super admin can promote and demote moderators", async () => {
        const sa = await makeUser("superadmin");
        const target = await makeUser("user");
        let res = await as(sa.token).patch(`/api/admin/management/users/${target.id}/role`, { role: "moderator", confirm: true });
        assert.equal(res.status, 200);
        assert.equal((await User.findById(target.id)).role, "moderator");
        res = await as(sa.token).patch(`/api/admin/management/users/${target.id}/role`, { role: "user", confirm: true });
        assert.equal(res.status, 200);
        assert.equal((await User.findById(target.id)).role, "user");
        assert.ok(await AdminAuditLog.findOne({ action: "role.promote_moderator" }));
        assert.ok(await AdminAuditLog.findOne({ action: "role.demote_moderator" }));
    });

    it("8b. role changes require explicit confirmation and an allowlisted transition", async () => {
        const sa = await makeUser("superadmin");
        const target = await makeUser("user");
        const path = `/api/admin/management/users/${target.id}/role`;
        assert.equal((await as(sa.token).patch(path, { role: "admin" })).status, 400);
        assert.equal((await as(sa.token).patch(path, { role: "admin", confirm: "true" })).status, 400);
        assert.equal((await as(sa.token).patch(path, { role: "wizard", confirm: true })).status, 400);
        assert.equal((await as(sa.token).patch(path, { role: "user", confirm: true })).status, 400); // no-op
        // admin -> moderator must go through "user" first
        const admin = await makeUser("admin");
        assert.equal((await as(sa.token).patch(`/api/admin/management/users/${admin.id}/role`, { role: "moderator", confirm: true })).status, 400);
        assert.equal((await as(sa.token).patch("/api/admin/management/users/not-an-id/role", { role: "admin", confirm: true })).status, 400);
    });

    it("8c. nobody can be made a super admin through the API", async () => {
        const sa = await makeUser("superadmin");
        const target = await makeUser("user");
        const res = await as(sa.token).patch(`/api/admin/management/users/${target.id}/role`, { role: "superadmin", confirm: true });
        assert.equal(res.status, 403);
        assert.equal((await User.findById(target.id)).role, "user");
    });

    it("10. super admin roles cannot be changed, and nobody changes their own role", async () => {
        const sa = await makeUser("superadmin");
        const lastOne = await User.countDocuments({ role: "superadmin" });
        assert.equal(lastOne, 1);
        // self-demotion is refused
        let res = await as(sa.token).patch(`/api/admin/management/users/${sa.id}/role`, { role: "user", confirm: true });
        assert.equal(res.status, 403);
        // another super admin cannot demote them either
        const sa2 = await makeUser("superadmin");
        res = await as(sa2.token).patch(`/api/admin/management/users/${sa.id}/role`, { role: "user", confirm: true });
        assert.equal(res.status, 403);
        assert.equal(await User.countDocuments({ role: "superadmin" }), 2);
        // self-promotion by an ordinary admin
        const admin = await makeUser("admin");
        res = await as(admin.token).patch(`/api/admin/management/users/${admin.id}/role`, { role: "superadmin", confirm: true });
        assert.equal(res.status, 403);
    });

    it("lists administrators with summary counts for super admins only", async () => {
        const sa = await makeUser("superadmin");
        await makeUser("admin");
        await makeUser("moderator");
        await makeUser("user");
        const res = await as(sa.token).get("/api/admin/management/staff");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.summary, { superadmins: 1, admins: 1, moderators: 1 });
        assert.equal(res.body.data.staff.length, 3);
        assert.ok(res.body.data.staff.every((s) => !("password" in s) && !("refreshToken" in s)));
        const filtered = await as(sa.token).get("/api/admin/management/staff?role=admin");
        assert.equal(filtered.body.data.staff.length, 1);
    });
});

describe("authorization is database-backed", () => {
    it("9. a demoted admin immediately loses admin access (with the same, still-valid token)", async () => {
        const admin = await makeUser("admin");
        assert.equal((await as(admin.token).get("/api/admin/stats")).status, 200);
        await User.updateOne({ _id: admin.id }, { role: "user" });
        assert.equal((await as(admin.token).get("/api/admin/stats")).status, 403);
        // category writes used a JWT-only check before; they must follow the database too
        const res = await as(admin.token).post("/api/categories", { name: "Poetry" });
        assert.equal(res.status, 403);
    });

    it("9b. a demoted moderator immediately loses moderation access", async () => {
        const mod = await makeUser("moderator");
        assert.equal((await as(mod.token).get("/api/admin/reports")).status, 200);
        await User.updateOne({ _id: mod.id }, { role: "user" });
        assert.equal((await as(mod.token).get("/api/admin/reports")).status, 403);
    });

    it("9c. a token that claims admin does not grant admin when the database says user", async () => {
        const user = await makeUser("user");
        const forged = jwt.sign({ id: user.id, role: "superadmin" }, process.env.JWT_SECRET, { expiresIn: "5m" });
        assert.equal((await as(forged).get("/api/admin/stats")).status, 403);
        assert.equal((await as(forged).get("/api/admin/management/staff")).status, 403);
    });

    it("9d. a promoted user gains access without re-login", async () => {
        const user = await makeUser("user");
        assert.equal((await as(user.token).get("/api/admin/stats")).status, 403);
        await User.updateOne({ _id: user.id }, { role: "admin" });
        assert.equal((await as(user.token).get("/api/admin/stats")).status, 200);
    });

    it("a soft-deleted user cannot use protected APIs", async () => {
        const user = await makeUser("user");
        await User.updateOne({ _id: user.id }, { isDeleted: true, deletedAt: new Date() });
        assert.equal((await as(user.token).get("/api/me")).status, 401);
        assert.equal((await as(user.token).get("/api/users/profile")).status, 401);
    });

    it("mass assignment: registration and profile updates cannot set a role", async () => {
        const res = await api().post("/api/register").send({
            username: "sneaky", email: "sneaky@example.test", password: PASSWORD, role: "superadmin", roleChangedAt: new Date()
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.data.role, "user");
        assert.equal((await User.findOne({ username: "sneaky" })).role, "user");

        const { token, id } = await makeUser("user");
        const upd = await as(token).put("/api/users/profile", { bio: "hi", role: "admin", isDeleted: false });
        assert.ok(upd.status < 500);
        assert.equal((await User.findById(id)).role, "user");
    });

    it("registration can be closed by a super admin", async () => {
        const sa = await makeUser("superadmin");
        const off = await as(sa.token).patch("/api/admin/settings", { registrationOpen: false, reason: "maintenance" });
        assert.equal(off.status, 200);
        const blocked = await api().post("/api/register").send({ username: "latecomer", email: "late@example.test", password: PASSWORD });
        assert.equal(blocked.status, 403);
        await as(sa.token).patch("/api/admin/settings", { registrationOpen: true });
        const ok = await api().post("/api/register").send({ username: "latecomer", email: "late@example.test", password: PASSWORD });
        assert.equal(ok.status, 201);
        assert.ok(await AdminAuditLog.findOne({ action: "setting.update" }));
    });
});

describe("existing auth flows", () => {
    it("22. login, /me, refresh and logout still work and return the current role", async () => {
        const reg = await api().post("/api/register").send({ username: "flowuser", email: "flow@example.test", password: PASSWORD });
        assert.equal(reg.status, 201);

        const agent = request.agent(app);
        const login = await agent.post("/api/login").send({ email: "flow@example.test", password: PASSWORD });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        const accessToken = login.body.data.accessToken;
        assert.ok(accessToken);

        let me = await agent.get("/api/me").set("Authorization", `Bearer ${accessToken}`);
        assert.equal(me.status, 200);
        assert.equal(me.body.data.role, "user");
        assert.ok(!("password" in me.body.data) && !("refreshToken" in me.body.data));

        // /me and refresh reflect a role change immediately
        await User.updateOne({ username: "flowuser" }, { role: "moderator" });
        me = await agent.get("/api/me").set("Authorization", `Bearer ${accessToken}`);
        assert.equal(me.body.data.role, "moderator");

        const refreshed = await agent.post("/api/refresh");
        assert.equal(refreshed.status, 200);
        assert.equal(jwt.decode(refreshed.body.data.accessToken).role, "moderator");

        const out = await agent.post("/api/logout");
        assert.equal(out.status, 200);
        assert.equal((await agent.post("/api/refresh")).status, 401);
    });

    it("a deactivated account cannot log in or refresh", async () => {
        const { user } = await makeUser("user", { username: "gone" });
        const agent = request.agent(app);
        const login = await agent.post("/api/login").send({ email: user.email, password: PASSWORD });
        assert.equal(login.status, 200);
        await User.updateOne({ _id: user._id }, { isDeleted: true, deletedAt: new Date() });
        assert.equal((await agent.post("/api/refresh")).status, 403);
        assert.equal((await request(app).post("/api/login").send({ email: user.email, password: PASSWORD })).status, 403);
    });
});
