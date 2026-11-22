import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    connect, disconnect, resetDb, makeUser, makePost, makeCategory, as, api,
    User, Post, Comment, Report, AdminAuditLog, Notification, Like, Bookmark, Follow, PostRevision, Category,
    transactionsSupported
} from "./helpers.js";

before(connect);
after(disconnect);
beforeEach(resetDb);

const comment = (post, author, content, parent = null) =>
    Comment.create({ post: post._id, author: author._id || author, content, parentComment: parent?._id || null });

describe("account moderation", () => {
    it("12/13. soft deleting a user hides them and their posts; restoring brings both back", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const live = await makePost(author.user);
        const earlier = await makePost(author.user);
        await Post.updateOne({ _id: earlier._id }, { isDeleted: true, deletedAt: new Date(Date.now() - 86400000), deletedBy: author.user._id });

        const del = await as(admin.token).delete(`/api/admin/users/${author.id}`, { reason: "spam account" });
        assert.equal(del.status, 200, JSON.stringify(del.body));
        assert.equal(await User.findById(author.id), null);
        assert.equal(await Post.findById(live._id), null);
        assert.equal((await as(author.token).get("/api/me")).status, 401);

        const listed = await as(admin.token).get("/api/admin/users?deleted=true");
        assert.equal(listed.body.data.users.length, 1);

        const restored = await as(admin.token).patch(`/api/admin/users/${author.id}/restore`);
        assert.equal(restored.status, 200);
        assert.ok(await User.findById(author.id));
        assert.ok(await Post.findById(live._id), "post hidden with the account returns");
        assert.equal(await Post.findById(earlier._id), null, "a post the author deleted earlier stays deleted");
        assert.ok(await AdminAuditLog.findOne({ action: "user.deactivate" }));
        assert.ok(await AdminAuditLog.findOne({ action: "user.restore" }));
    });

    it("11. an administrator cannot delete their own account; super admins are protected", async () => {
        const sa = await makeUser("superadmin");
        const sa2 = await makeUser("superadmin");
        const admin = await makeUser("admin");
        assert.equal((await as(sa.token).delete(`/api/admin/users/${sa.id}`)).status, 400);
        assert.ok(await User.findById(sa.id));
        assert.equal((await as(sa.token).delete(`/api/admin/users/${sa2.id}`)).status, 403);
        assert.equal((await as(admin.token).delete(`/api/admin/users/${sa.id}`)).status, 403);
        assert.equal((await as(admin.token).delete(`/api/admin/users/${admin.id}`)).status, 400);
    });

    it("admins cannot deactivate other admins; moderators cannot deactivate anyone; super admin can deactivate an admin", async () => {
        const sa = await makeUser("superadmin");
        const admin = await makeUser("admin");
        const admin2 = await makeUser("admin");
        const mod = await makeUser("moderator");
        const user = await makeUser("user");
        assert.equal((await as(admin.token).delete(`/api/admin/users/${admin2.id}`)).status, 403);
        assert.equal((await as(mod.token).delete(`/api/admin/users/${user.id}`)).status, 403);
        assert.equal((await as(admin.token).delete(`/api/admin/users/${mod.id}`)).status, 200); // admin may handle moderators
        assert.equal((await as(sa.token).delete(`/api/admin/users/${admin2.id}`)).status, 200);
    });

    it("16. permanent deletion removes the account and everything attached to it", async () => {
        const admin = await makeUser("admin");
        const victim = await makeUser("user");
        const other = await makeUser("user");

        const hisPost = await makePost(victim.user);
        const theirPost = await makePost(other.user);
        await Like.create({ user: other.id, post: hisPost._id });
        await Like.create({ user: victim.id, post: theirPost._id });
        await Bookmark.create({ user: victim.id, post: theirPost._id });
        await Follow.create({ follower: victim.id, following: other.id });
        await Follow.create({ follower: other.id, following: victim.id });
        await Notification.create({ recipient: other.id, sender: victim.id, type: "LIKE", post: theirPost._id });
        const hisComment = await comment(theirPost, victim.user, "leaf comment by the victim");
        const threadRoot = await comment(theirPost, victim.user, "root by the victim");
        const reply = await comment(theirPost, other.user, "reply by someone else", threadRoot);
        await comment(hisPost, other.user, "comment on the victim's post");

        // must be soft deleted first
        assert.equal((await as(admin.token).delete(`/api/admin/users/${victim.id}/permanent`)).status, 404);
        assert.equal((await as(admin.token).delete(`/api/admin/users/${victim.id}`)).status, 200);
        const res = await as(admin.token).delete(`/api/admin/users/${victim.id}/permanent`, { reason: "requested by user" });
        assert.equal(res.status, 200, JSON.stringify(res.body));

        assert.equal(await User.findOne({ _id: victim.id }).setOptions({ withDeleted: true }), null);
        assert.equal(await Post.findOne({ _id: hisPost._id }).setOptions({ withDeleted: true }), null);
        assert.equal(await Like.countDocuments({ $or: [{ user: victim.id }, { post: hisPost._id }] }), 0);
        assert.equal(await Bookmark.countDocuments({ user: victim.id }), 0);
        assert.equal(await Follow.countDocuments({ $or: [{ follower: victim.id }, { following: victim.id }] }), 0);
        assert.equal(await Notification.countDocuments({ $or: [{ sender: victim.id }, { recipient: victim.id }] }), 0);
        assert.equal(await Comment.countDocuments({ post: hisPost._id }), 0);
        assert.equal(await Comment.findById(hisComment._id), null, "a comment nobody replied to is deleted");
        // Thread integrity: the root had a reply from someone else, so it survives as a placeholder
        const root = await Comment.findById(threadRoot._id);
        assert.equal(root.content, "[deleted]");
        assert.equal(root.isDeleted, true);
        assert.ok(await Comment.findById(reply._id), "the other user's reply is untouched");
        assert.ok(await Post.findById(theirPost._id), "other people's posts are untouched");
        assert.ok(await AdminAuditLog.findOne({ action: "user.purge" }));
    });

    it("permanent deletion is refused for super admins, admins (by admins) and active accounts", async () => {
        const sa = await makeUser("superadmin");
        const admin = await makeUser("admin");
        const admin2 = await makeUser("admin");
        await User.updateOne({ _id: admin2.id }, { isDeleted: true, deletedAt: new Date() });
        await User.updateOne({ _id: sa.id }, { isDeleted: true, deletedAt: new Date() });
        assert.equal((await as(admin.token).delete(`/api/admin/users/${admin2.id}/permanent`)).status, 403);
        assert.equal((await as(admin.token).delete(`/api/admin/users/${sa.id}/permanent`)).status, 403);
        assert.ok(await User.findOne({ _id: sa.id }).setOptions({ withDeleted: true }));
    });

    it("user detail and list expose role, activity and report data, with allowed actions", async () => {
        const sa = await makeUser("superadmin");
        const user = await makeUser("user");
        const reporter = await makeUser("user");
        await makePost(user.user);
        await Report.create({ reporter: reporter.id, targetType: "user", targetId: user.id, targetOwner: user.id, reason: "spam" });

        const detail = await as(sa.token).get(`/api/admin/users/${user.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.counts.posts, 1);
        assert.equal(detail.body.data.reports.againstOpen, 1);
        assert.deepEqual(detail.body.data.actions.roleOptions.sort(), ["admin", "moderator"]);
        assert.ok(!("password" in detail.body.data.user));

        const list = await as(sa.token).get("/api/admin/users?role=user&search=user");
        assert.equal(list.status, 200);
        assert.ok(list.body.data.users.every((u) => u.role === "user"));
        assert.equal((await as(sa.token).get("/api/admin/users?role=wizard")).status, 400);

        const adminView = await makeUser("admin");
        const asAdmin = await as(adminView.token).get(`/api/admin/users/${user.id}`);
        assert.deepEqual(asAdmin.body.data.actions.roleOptions, []);
    });
});

describe("post moderation", () => {
    it("14/15. admins can soft delete and restore a post; the removal is audited with its reason", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const post = await makePost(author.user);

        const del = await as(admin.token).delete(`/api/admin/posts/${post._id}`, { reason: "violates rules" });
        assert.equal(del.status, 200);
        assert.equal(await Post.findById(post._id), null);
        const stored = await Post.findOne({ _id: post._id }).setOptions({ withDeleted: true });
        assert.equal(stored.moderationReason, "violates rules");
        assert.equal(stored.deletedBy.toString(), admin.id);

        // the author cannot undo a staff removal
        assert.equal((await as(author.token).patch(`/api/posts/${post._id}/restore`)).status, 403);
        assert.equal((await as(author.token).delete(`/api/posts/${post._id}/permanent`)).status, 403);

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}/restore`)).status, 200);
        assert.ok(await Post.findById(post._id));
        assert.equal((await Post.findById(post._id)).moderationReason, null);
        const log = await AdminAuditLog.findOne({ action: "post.remove" });
        assert.equal(log.reason, "violates rules");
        assert.ok(await AdminAuditLog.findOne({ action: "post.restore" }));
    });

    it("moderators must give a reason, can only act on normal users' content, and can only restore their own removals", async () => {
        const mod = await makeUser("moderator");
        const mod2 = await makeUser("moderator");
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        const adminPost = await makePost(admin.user);

        assert.equal((await as(mod.token).delete(`/api/admin/posts/${post._id}`)).status, 400);
        assert.equal((await as(mod.token).delete(`/api/admin/posts/${adminPost._id}`, { reason: "trying it on" })).status, 403);
        assert.equal((await as(mod.token).delete(`/api/admin/posts/${post._id}`, { reason: "harassment" })).status, 200);
        assert.equal((await as(mod2.token).patch(`/api/admin/posts/${post._id}/restore`)).status, 403);
        assert.equal((await as(mod.token).patch(`/api/admin/posts/${post._id}/restore`)).status, 200);
        // and never permanent deletion
        await as(mod.token).delete(`/api/admin/posts/${post._id}`, { reason: "again again" });
        assert.equal((await as(mod.token).delete(`/api/admin/posts/${post._id}/permanent`)).status, 403);
    });

    it("an admin cannot remove a super admin's post", async () => {
        const admin = await makeUser("admin");
        const sa = await makeUser("superadmin");
        const post = await makePost(sa.user);
        assert.equal((await as(admin.token).delete(`/api/admin/posts/${post._id}`)).status, 403);
    });

    it("permanently deleting a post removes its likes, bookmarks, comments and notifications", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const fan = await makeUser("user");
        const post = await makePost(author.user);
        await Like.create({ user: fan.id, post: post._id });
        await Bookmark.create({ user: fan.id, post: post._id });
        await comment(post, fan.user, "nice");
        await Notification.create({ recipient: author.id, sender: fan.id, type: "LIKE", post: post._id });

        assert.equal((await as(admin.token).delete(`/api/admin/posts/${post._id}/permanent`)).status, 404);
        await as(admin.token).delete(`/api/admin/posts/${post._id}`);
        assert.equal((await as(admin.token).delete(`/api/admin/posts/${post._id}/permanent`)).status, 200);
        assert.equal(await Post.findOne({ _id: post._id }).setOptions({ withDeleted: true }), null);
        assert.equal(await Like.countDocuments({ post: post._id }), 0);
        assert.equal(await Bookmark.countDocuments({ post: post._id }), 0);
        assert.equal(await Comment.countDocuments({ post: post._id }), 0);
        assert.equal(await Notification.countDocuments({ post: post._id }), 0);
        assert.ok(await AdminAuditLog.findOne({ action: "post.purge" }));
    });

    it("editing keeps the original text, records an audit entry and cannot change protected fields", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const post = await makePost(author.user, { title: "Original title", content: "Original body" });

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}`, { title: "Edited" })).status, 400, "reason required");
        const res = await as(admin.token).patch(`/api/admin/posts/${post._id}`, {
            title: "Edited title", content: "Edited body", reason: "removed a phone number",
            author: admin.id, status: "draft", isFeatured: true, slug: "hijack"
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));

        const after = await Post.findById(post._id);
        assert.equal(after.title, "Edited title");
        assert.equal(after.author.toString(), author.id, "authorship is preserved");
        assert.equal(after.status, "published");
        assert.equal(after.isFeatured, false);
        assert.equal(after.slug, post.slug, "the public URL does not change");

        const revision = await PostRevision.findOne({ post: post._id });
        assert.equal(revision.before.title, "Original title");
        assert.equal(revision.before.content, "Original body");
        assert.deepEqual([...revision.changedFields].sort(), ["content", "title"]);
        const log = await AdminAuditLog.findOne({ action: "post.edit" });
        assert.equal(log.reason, "removed a phone number");

        // authors can no longer be silently overwritten through the public route either
        assert.equal((await as(admin.token).put(`/api/posts/${post._id}`, { title: "sneaky" })).status, 403);
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}`, { title: "Edited title", reason: "same" })).status, 400, "no-op edits are rejected");
    });

    it("unpublishing holds the post so the author cannot republish it; publishing releases it", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const post = await makePost(author.user);

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}/status`, { status: "draft" })).status, 400, "reason required to unpublish");
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}/status`, { status: "draft", reason: "under review" })).status, 200);
        assert.equal((await Post.findById(post._id)).status, "draft");
        assert.ok(await AdminAuditLog.findOne({ action: "post.unpublish" }));

        const blocked = await as(author.token).put(`/api/posts/${post._id}`, { status: "published" });
        assert.equal(blocked.status, 403);
        assert.equal((await Post.findById(post._id)).status, "draft");

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}/status`, { status: "published" })).status, 200);
        assert.equal((await Post.findById(post._id)).moderationHold, false);
        assert.ok(await AdminAuditLog.findOne({ action: "post.publish" }));
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${post._id}/status`, { status: "published" })).status, 409);
    });

    it("post history is visible to staff and revisions only to admins", async () => {
        const admin = await makeUser("admin");
        const mod = await makeUser("moderator");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        await as(admin.token).patch(`/api/admin/posts/${post._id}`, { title: "A new title", reason: "typo fix" });
        const adminView = await as(admin.token).get(`/api/admin/posts/${post._id}/history`);
        assert.equal(adminView.body.data.history.length, 1);
        assert.equal(adminView.body.data.revisions.length, 1);
        const modView = await as(mod.token).get(`/api/admin/posts/${post._id}/history`);
        assert.equal(modView.status, 200);
        assert.equal(modView.body.data.revisions.length, 0);
    });
});

describe("featured posts", () => {
    it("19. only published, live posts can be featured and they disappear when deleted or unpublished", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const good = await makePost(author.user, { title: "Good one" });
        const draft = await makePost(author.user, { status: "draft" });
        const goingAway = await makePost(author.user, { title: "Going away" });

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${draft._id}/feature`, { featured: true })).status, 409);
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${good._id}/feature`, { featured: true })).status, 200);
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${good._id}/feature`, { featured: true })).status, 409, "no duplicate entries");
        assert.equal((await as(admin.token).patch(`/api/admin/posts/${goingAway._id}/feature`, { featured: true })).status, 200);

        let pub = await api().get("/api/posts/featured");
        assert.equal(pub.status, 200);
        assert.deepEqual(pub.body.data.map((p) => p.title), ["Good one", "Going away"]);

        await as(admin.token).delete(`/api/admin/posts/${goingAway._id}`);
        await Post.updateOne({ _id: good._id }, { status: "draft" });
        pub = await api().get("/api/posts/featured");
        assert.deepEqual(pub.body.data, []);

        // the admin view still lists them, flagged as hidden
        const list = await as(admin.token).get("/api/admin/featured");
        assert.equal(list.body.data.posts.length, 2);
        assert.deepEqual(list.body.data.posts.map((p) => p.hiddenReason).sort(), ["deleted", "unpublished"]);
        assert.ok(await AdminAuditLog.findOne({ action: "post.feature" }));
    });

    it("supports unfeaturing and a display order, and rejects non-admins", async () => {
        const admin = await makeUser("admin");
        const mod = await makeUser("moderator");
        const author = await makeUser("user");
        const a = await makePost(author.user, { title: "A" });
        const b = await makePost(author.user, { title: "B" });
        await as(admin.token).patch(`/api/admin/posts/${a._id}/feature`, { featured: true });
        await as(admin.token).patch(`/api/admin/posts/${b._id}/feature`, { featured: true });
        assert.deepEqual((await api().get("/api/posts/featured")).body.data.map((p) => p.title), ["A", "B"]);

        const reorder = await as(admin.token).put("/api/admin/featured/order", { ids: [b._id, a._id] });
        assert.equal(reorder.status, 200);
        assert.deepEqual((await api().get("/api/posts/featured")).body.data.map((p) => p.title), ["B", "A"]);
        assert.equal((await as(admin.token).put("/api/admin/featured/order", { ids: [b._id] })).status, 400, "must include the whole set");

        assert.equal((await as(admin.token).patch(`/api/admin/posts/${a._id}/feature`, { featured: false })).status, 200);
        assert.deepEqual((await api().get("/api/posts/featured")).body.data.map((p) => p.title), ["B"]);
        assert.equal((await as(mod.token).get("/api/admin/featured")).status, 403);
    });
});

describe("comment moderation", () => {
    it("17. removing a comment keeps its replies, masks it publicly, updates counts and can be undone", async () => {
        const mod = await makeUser("moderator");
        const author = await makeUser("user");
        const replier = await makeUser("user");
        const post = await makePost(author.user);
        const parent = await comment(post, author.user, "a rude comment");
        const reply = await comment(post, replier.user, "a polite reply", parent);
        await Notification.create({ recipient: author.id, sender: replier.id, type: "COMMENT", post: post._id, comment: reply._id });
        const parentNotice = await Notification.create({ recipient: author.id, sender: replier.id, type: "COMMENT", post: post._id, comment: parent._id });

        assert.equal((await as(mod.token).delete(`/api/admin/comments/${parent._id}`)).status, 400, "moderators must give a reason");
        const res = await as(mod.token).delete(`/api/admin/comments/${parent._id}`, { reason: "abusive language" });
        assert.equal(res.status, 200, JSON.stringify(res.body));

        const stored = await Comment.findById(parent._id);
        assert.equal(stored.isDeleted, true);
        assert.equal(stored.content, "a rude comment", "original text is kept so it can be restored");
        assert.equal(stored.moderationReason, "abusive language");
        assert.equal(stored.deletedBy.toString(), mod.id);
        assert.ok(stored.deletedAt);
        assert.ok(await Comment.findById(reply._id), "reply survives");
        assert.equal((await Comment.findById(reply._id)).parentComment.toString(), parent._id.toString());
        assert.equal(await Notification.findById(parentNotice._id), null, "notification for the removed comment is cleaned up");

        // public view: the parent is a placeholder with no moderation details or author
        const pub = await api().get(`/api/posts/${post._id}/comments`);
        const shown = pub.body.data.find((c) => c._id === parent._id.toString());
        assert.equal(shown.content, "[deleted]");
        assert.equal(shown.isDeleted, true);
        assert.equal(shown.author.username, "[deleted]");
        assert.ok(!("moderationReason" in shown) && !("deletedBy" in shown));
        assert.ok(pub.body.data.find((c) => c._id === reply._id.toString()), "reply still returned");
        assert.equal(await Comment.countDocuments({ post: post._id, isDeleted: false }), 1);

        assert.equal((await as(mod.token).patch(`/api/admin/comments/${parent._id}/restore`)).status, 200);
        const back = await Comment.findById(parent._id);
        assert.equal(back.isDeleted, false);
        assert.equal(back.content, "a rude comment");
        assert.equal(back.deletedBy, null);
        assert.ok(await AdminAuditLog.findOne({ action: "comment.remove" }));
        assert.ok(await AdminAuditLog.findOne({ action: "comment.restore" }));
    });

    it("permanent removal keeps a placeholder when there are replies, and deletes the row when there are none", async () => {
        const admin = await makeUser("admin");
        const mod = await makeUser("moderator");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        const parent = await comment(post, author.user, "parent");
        const child = await comment(post, author.user, "child", parent);
        const leaf = await comment(post, author.user, "standalone");

        assert.equal((await as(admin.token).delete(`/api/admin/comments/${parent._id}/permanent`)).status, 404, "must be removed first");
        await as(admin.token).delete(`/api/admin/comments/${parent._id}`);
        assert.equal((await as(mod.token).delete(`/api/admin/comments/${parent._id}/permanent`)).status, 403, "moderators cannot purge");

        const purge = await as(admin.token).delete(`/api/admin/comments/${parent._id}/permanent`);
        assert.equal(purge.status, 200);
        assert.equal(purge.body.mode, "tombstoned");
        const tomb = await Comment.findById(parent._id);
        assert.equal(tomb.content, "[deleted]");
        assert.ok(await Comment.findById(child._id));
        assert.equal((await as(admin.token).patch(`/api/admin/comments/${parent._id}/restore`)).status, 409, "purged text cannot come back");

        // a childless removed comment is deleted outright
        await as(admin.token).delete(`/api/admin/comments/${leaf._id}`);
        const purgeLeaf = await as(admin.token).delete(`/api/admin/comments/${leaf._id}/permanent`);
        assert.equal(purgeLeaf.body.mode, "deleted");
        assert.equal(await Comment.findById(leaf._id), null);

        // removing and purging the last child also clears the now-empty placeholder above it
        await as(admin.token).delete(`/api/admin/comments/${child._id}`);
        const purgeChild = await as(admin.token).delete(`/api/admin/comments/${child._id}/permanent`);
        assert.equal(purgeChild.body.mode, "deleted");
        assert.equal(await Comment.findById(parent._id), null, "empty placeholder ancestor is pruned");
    });

    it("lists, searches and filters comments; moderators cannot touch staff comments", async () => {
        const mod = await makeUser("moderator");
        const admin = await makeUser("admin");
        const a = await makeUser("user", { username: "alice" });
        const b = await makeUser("user", { username: "bob" });
        const post1 = await makePost(a.user);
        const post2 = await makePost(b.user);
        await comment(post1, a.user, "hello world");
        const spam = await comment(post1, b.user, "buy cheap watches");
        await comment(post2, b.user, "another one");
        const staffComment = await comment(post2, admin.user, "official statement");
        await Comment.updateOne({ _id: spam._id }, { isDeleted: true, deletedBy: admin.id, deletedAt: new Date() });

        const get = (q) => as(mod.token).get(`/api/admin/comments?${q}`);
        assert.equal((await get("")).body.data.comments.length, 3, "defaults to active");
        assert.equal((await get("status=deleted")).body.data.comments.length, 1);
        assert.equal((await get("status=all")).body.data.comments.length, 4);
        assert.equal((await get("search=hello")).body.data.comments.length, 1);
        assert.equal((await get("author=bob&status=all")).body.data.comments.length, 2);
        assert.equal((await get(`post=${post1._id}&status=all`)).body.data.comments.length, 2);
        assert.equal((await get("post=nope")).status, 400);
        const page = await get("status=all&limit=2&page=2");
        assert.equal(page.body.data.pagination.totalPages, 2);

        assert.equal((await as(mod.token).delete(`/api/admin/comments/${staffComment._id}`, { reason: "not allowed" })).status, 403);
        const detail = await as(mod.token).get(`/api/admin/comments/${spam._id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.comment.post.title, post1.title);
    });

    it("the public delete route sends staff through the audited path and keeps author deletes working", async () => {
        const mod = await makeUser("moderator");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        const theirs = await comment(post, author.user, "mine");
        const parent = await comment(post, author.user, "parent");
        await comment(post, author.user, "child", parent);

        assert.equal((await as(mod.token).delete(`/api/comments/${theirs._id}`)).status, 400, "reason required");
        assert.equal((await as(mod.token).delete(`/api/comments/${theirs._id}`, { reason: "off topic" })).status, 200);
        assert.ok(await AdminAuditLog.findOne({ action: "comment.remove" }));

        const own = await as(author.token).delete(`/api/comments/${parent._id}`);
        assert.equal(own.status, 200);
        assert.equal(own.body.softDeleted, true);
        const stored = await Comment.findById(parent._id);
        assert.equal(stored.content, "[deleted]");
        // an author-deleted comment is not restorable by staff (text is gone)
        assert.equal((await as(mod.token).patch(`/api/admin/comments/${parent._id}/restore`)).status, 409);
    });
});

describe("reports", () => {
    it("18. users can report posts, comments and accounts; staff can review and resolve", async () => {
        const reporter = await makeUser("user");
        const author = await makeUser("user");
        const mod = await makeUser("moderator");
        const post = await makePost(author.user, { title: "Spammy post" });
        const bad = await comment(post, author.user, "spam spam spam");

        let res = await as(reporter.token).post("/api/reports", { targetType: "post", targetId: post._id, reason: "spam", description: "ad" });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        res = await as(reporter.token).post("/api/reports", { targetType: "comment", targetId: bad._id, reason: "harassment" });
        assert.equal(res.status, 201);
        res = await as(reporter.token).post("/api/reports", { targetType: "user", targetId: author.id, reason: "impersonation" });
        assert.equal(res.status, 201);
        assert.equal(await Report.countDocuments(), 3);

        const list = await as(mod.token).get("/api/admin/reports?status=pending");
        assert.equal(list.body.data.reports.length, 3);
        assert.equal((await as(mod.token).get("/api/admin/reports?reason=spam")).body.data.reports.length, 1);
        assert.equal((await as(mod.token).get("/api/admin/reports?targetType=comment")).body.data.reports.length, 1);
        assert.equal((await as(mod.token).get("/api/admin/reports?search=spammy")).body.data.reports.length, 1);
        assert.equal((await as(mod.token).get("/api/admin/reports?status=bogus")).status, 400);

        const postReport = await Report.findOne({ targetType: "post" });
        const detail = await as(mod.token).get(`/api/admin/reports/${postReport._id}`);
        assert.equal(detail.body.data.target.title, "Spammy post");

        assert.equal((await as(mod.token).patch(`/api/admin/reports/${postReport._id}/assign`, { assignTo: "me" })).status, 200);
        assert.equal((await Report.findById(postReport._id)).status, "under_review");

        const resolve = await as(mod.token).post(`/api/admin/reports/${postReport._id}/resolve`, {
            outcome: "resolved", action: "remove_content", resolution: "Confirmed spam, post removed"
        });
        assert.equal(resolve.status, 200, JSON.stringify(resolve.body));
        const done = await Report.findById(postReport._id);
        assert.equal(done.status, "resolved");
        assert.equal(done.resolvedBy.toString(), mod.id);
        assert.ok(done.resolvedAt);
        assert.equal(await Post.findById(post._id), null, "the moderation action was applied");
        assert.ok(await AdminAuditLog.findOne({ action: "report.assign" }));
        assert.ok(await AdminAuditLog.findOne({ action: "report.resolve" }));

        // closed reports cannot be resolved twice
        assert.equal((await as(mod.token).post(`/api/admin/reports/${postReport._id}/resolve`, { outcome: "dismissed", resolution: "oops" })).status, 409);

        const commentReport = await Report.findOne({ targetType: "comment" });
        const dismiss = await as(mod.token).post(`/api/admin/reports/${commentReport._id}/resolve`, { outcome: "dismissed", resolution: "Not a violation" });
        assert.equal(dismiss.status, 200);
        assert.equal((await Report.findById(commentReport._id)).status, "dismissed");
        assert.ok(await AdminAuditLog.findOne({ action: "report.dismiss" }));
        assert.equal((await as(mod.token).post(`/api/admin/reports/${commentReport._id}/resolve`, { outcome: "dismissed" })).status, 409, "closed");
    });

    it("blocks self reports, duplicate reports, bad input and reports of missing or hidden things", async () => {
        const reporter = await makeUser("user");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        const mine = await makePost(reporter.user);
        const draft = await makePost(author.user, { status: "draft" });
        const body = (extra) => ({ targetType: "post", targetId: post._id, reason: "spam", ...extra });

        assert.equal((await as(reporter.token).post("/api/reports", body({ targetId: mine._id }))).status, 400, "own post");
        assert.equal((await as(reporter.token).post("/api/reports", { targetType: "user", targetId: reporter.id, reason: "spam" })).status, 400, "self");
        const ownComment = await comment(post, reporter.user, "my words");
        assert.equal((await as(reporter.token).post("/api/reports", { targetType: "comment", targetId: ownComment._id, reason: "spam" })).status, 400, "own comment");

        assert.equal((await as(reporter.token).post("/api/reports", body())).status, 201);
        assert.equal((await as(reporter.token).post("/api/reports", body({ reason: "harassment" }))).status, 409, "duplicate, even with another reason");
        assert.equal(await Report.countDocuments(), 1);

        assert.equal((await as(reporter.token).post("/api/reports", body({ reason: "nonsense" }))).status, 400);
        assert.equal((await as(reporter.token).post("/api/reports", body({ targetType: "planet" }))).status, 400);
        assert.equal((await as(reporter.token).post("/api/reports", body({ targetId: "abc" }))).status, 400);
        assert.equal((await as(reporter.token).post("/api/reports", body({ reason: "other" }))).status, 400, "other needs a description");
        assert.equal((await as(reporter.token).post("/api/reports", body({ description: "x".repeat(1001), targetId: draft._id }))).status, 400);
        assert.equal((await as(reporter.token).post("/api/reports", body({ targetId: draft._id }))).status, 404, "drafts cannot be reported");
        assert.equal((await api().post("/api/reports").send(body())).status, 401);
    });

    it("reports are not readable or resolvable by regular users, and moderators cannot take over assigned reports", async () => {
        const reporter = await makeUser("user");
        const author = await makeUser("user");
        const mod1 = await makeUser("moderator");
        const mod2 = await makeUser("moderator");
        const admin = await makeUser("admin");
        const post = await makePost(author.user);
        await as(reporter.token).post("/api/reports", { targetType: "post", targetId: post._id, reason: "spam" });
        const report = await Report.findOne();

        assert.equal((await as(reporter.token).get("/api/admin/reports")).status, 403);
        assert.equal((await as(reporter.token).get(`/api/admin/reports/${report._id}`)).status, 403);

        await as(mod1.token).patch(`/api/admin/reports/${report._id}/assign`, { assignTo: "me" });
        assert.equal((await as(mod2.token).patch(`/api/admin/reports/${report._id}/assign`, { assignTo: "me" })).status, 403);
        assert.equal((await as(mod2.token).post(`/api/admin/reports/${report._id}/resolve`, { outcome: "dismissed", resolution: "mine now" })).status, 403);
        const reassigned = await as(admin.token).patch(`/api/admin/reports/${report._id}/assign`, { assignTo: mod2.id });
        assert.equal(reassigned.status, 200);
        assert.equal((await Report.findById(report._id)).assignedTo.toString(), mod2.id);
        assert.equal((await as(admin.token).patch(`/api/admin/reports/${report._id}/assign`, { assignTo: reporter.id })).status, 400, "staff only");
    });

    it("resolving a user report can deactivate the account, subject to the role hierarchy", async () => {
        const mod = await makeUser("moderator");
        const admin = await makeUser("admin");
        const reporter = await makeUser("user");
        const offender = await makeUser("user");
        await as(reporter.token).post("/api/reports", { targetType: "user", targetId: offender.id, reason: "harassment" });
        const report = await Report.findOne();

        const denied = await as(mod.token).post(`/api/admin/reports/${report._id}/resolve`, { outcome: "resolved", action: "deactivate_account", resolution: "repeat abuse" });
        assert.equal(denied.status, 403);
        assert.ok(await User.findById(offender.id));
        assert.equal((await Report.findById(report._id)).status, "pending", "a refused action leaves the report open");

        const ok = await as(admin.token).post(`/api/admin/reports/${report._id}/resolve`, { outcome: "resolved", action: "deactivate_account", resolution: "repeat abuse" });
        assert.equal(ok.status, 200);
        assert.equal(await User.findById(offender.id), null);
    });
});

describe("categories", () => {
    it("admins manage categories with duplicate protection; moderators and users cannot", async () => {
        const admin = await makeUser("admin");
        const mod = await makeUser("moderator");
        const user = await makeUser("user");

        const created = await as(admin.token).post("/api/categories", { name: "Poetry", description: "Verse" });
        assert.equal(created.status, 201);
        assert.equal((await as(admin.token).post("/api/categories", { name: "poetry" })).status, 409, "case-insensitive duplicate");
        assert.equal((await as(admin.token).post("/api/categories", { name: "   " })).status, 400);
        assert.equal((await as(mod.token).post("/api/categories", { name: "Nope" })).status, 403);
        assert.equal((await as(user.token).post("/api/categories", { name: "Nope" })).status, 403);

        const id = created.body.data._id;
        const other = await as(admin.token).post("/api/categories", { name: "Essays" });
        assert.equal((await as(admin.token).put(`/api/categories/${other.body.data._id}`, { name: "POETRY" })).status, 409);
        assert.equal((await as(admin.token).put(`/api/categories/${id}`, { name: "Verse" })).status, 200);
        assert.equal((await as(admin.token).put("/api/categories/bad", { name: "X" })).status, 400);
        assert.ok(await AdminAuditLog.findOne({ action: "category.create" }));
        assert.ok(await AdminAuditLog.findOne({ action: "category.update" }));
    });

    it("reports usage counts and handles posts safely on delete", async () => {
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const a = await makeCategory("Alpha");
        const b = await makeCategory("Beta");
        const unused = await makeCategory("Unused");
        await makePost(author.user, { category: a._id });
        await makePost(author.user, { category: a._id });

        const list = await api().get("/api/categories?withCounts=true");
        assert.equal(list.body.data.find((c) => c.name === "Alpha").postsCount, 2);
        assert.equal(list.body.data.find((c) => c.name === "Unused").postsCount, 0);
        assert.ok(!("postsCount" in (await api().get("/api/categories")).body.data[0]), "default response is unchanged");

        const refused = await as(admin.token).delete(`/api/categories/${a._id}`);
        assert.equal(refused.status, 400);
        assert.equal(refused.body.postsUsing, 2);
        assert.ok(await Category.findById(a._id));

        assert.equal((await as(admin.token).delete(`/api/categories/${a._id}?reassignTo=${a._id}`)).status, 400);
        const moved = await as(admin.token).delete(`/api/categories/${a._id}?reassignTo=${b._id}`);
        assert.equal(moved.status, 200);
        assert.equal(await Post.countDocuments({ category: b._id }), 2);
        assert.equal(await Category.findById(a._id), null);

        assert.equal((await as(admin.token).delete(`/api/categories/${unused._id}`)).status, 200);
        assert.ok(await AdminAuditLog.findOne({ action: "category.delete" }));
    });
});

describe("audit log", () => {
    it("20. privileged actions create audit entries with actor, role, target and reason", async () => {
        const sa = await makeUser("superadmin");
        const admin = await makeUser("admin");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        await as(admin.token).delete(`/api/admin/posts/${post._id}`, { reason: "test reason" });
        const entry = await AdminAuditLog.findOne({ action: "post.remove" });
        assert.equal(entry.actor.toString(), admin.id);
        assert.equal(entry.actorRole, "admin");
        assert.equal(entry.actorUsername, admin.user.username);
        assert.equal(entry.targetType, "post");
        assert.equal(entry.targetId.toString(), post._id.toString());
        assert.equal(entry.reason, "test reason");
        assert.ok(entry.createdAt);
        void sa;
    });

    it("never stores secrets in metadata", async () => {
        const { recordAudit, sanitizeMetadata } = await import("../services/auditService.js");
        const clean = sanitizeMetadata({ ok: 1, password: "p", nested: { refreshToken: "t", accessToken: "a", fine: "yes", apiKey: "k", authorization: "Bearer x" }, list: [{ secret: "s", keep: 2 }] });
        assert.deepEqual(clean, { ok: 1, nested: { fine: "yes" }, list: [{ keep: 2 }] });
        const actor = await makeUser("admin");
        await recordAudit(actor.user, { action: "post.edit", targetType: "post", metadata: { password: "hunter2", note: "fine" } });
        const stored = await AdminAuditLog.findOne({ action: "post.edit" }).lean();
        assert.deepEqual(stored.metadata, { note: "fine" });
    });

    it("21. nobody can modify or delete audit logs, through the API or the model", async () => {
        const sa = await makeUser("superadmin");
        const author = await makeUser("user");
        const post = await makePost(author.user);
        await as(sa.token).delete(`/api/admin/posts/${post._id}`);
        const entry = await AdminAuditLog.findOne();

        for (const method of ["post", "put", "patch", "delete"]) {
            const res = await as(sa.token)[method]("/api/admin/audit-logs", {});
            assert.equal(res.status, 405, `${method} /audit-logs`);
            const one = await as(sa.token)[method](`/api/admin/audit-logs/${entry._id}`, {});
            assert.equal(one.status, 405, `${method} /audit-logs/:id`);
        }
        assert.ok(await AdminAuditLog.findById(entry._id));

        await assert.rejects(() => AdminAuditLog.updateOne({ _id: entry._id }, { reason: "tampered" }), /append-only/);
        await assert.rejects(() => AdminAuditLog.deleteMany({}), /append-only/);
        await assert.rejects(() => AdminAuditLog.findOneAndDelete({ _id: entry._id }), /append-only/);
        const doc = await AdminAuditLog.findById(entry._id);
        doc.reason = "tampered";
        await assert.rejects(() => doc.save(), /append-only/);
        await assert.rejects(() => doc.deleteOne(), /append-only/);
        assert.equal((await AdminAuditLog.findById(entry._id)).reason, "");

        // and regular users cannot read them at all
        assert.equal((await as(author.token).get("/api/admin/audit-logs")).status, 403);
    });

    it("visibility is scoped by role: super admin sees all, admin no role/setting entries, moderator only their own moderation", async () => {
        const sa = await makeUser("superadmin");
        const admin = await makeUser("admin");
        const mod = await makeUser("moderator");
        const mod2 = await makeUser("moderator");
        const target = await makeUser("user");
        const author = await makeUser("user");
        const p1 = await makePost(author.user);
        const p2 = await makePost(author.user);

        await as(sa.token).patch(`/api/admin/management/users/${target.id}/role`, { role: "moderator", confirm: true });
        await as(sa.token).patch("/api/admin/settings", { registrationOpen: false });
        await as(admin.token).patch(`/api/admin/posts/${p1._id}/feature`, { featured: true });
        await as(mod.token).delete(`/api/admin/posts/${p1._id}`, { reason: "my removal" });
        await as(mod2.token).delete(`/api/admin/posts/${p2._id}`, { reason: "theirs here" });

        const actions = async (token, q = "") => (await as(token).get(`/api/admin/audit-logs${q}`)).body.data.logs.map((l) => l.action).sort();
        const saActions = await actions(sa.token);
        assert.ok(saActions.includes("role.promote_moderator") && saActions.includes("setting.update"));
        assert.equal(saActions.length, 5);

        const adminActions = await actions(admin.token);
        assert.ok(!adminActions.some((a) => /^(role|setting)\./.test(a)));
        assert.equal(adminActions.length, 3);
        // filters can narrow but never widen what a role may see
        assert.deepEqual(await actions(admin.token, "?action=role.promote_moderator"), []);

        const modActions = await actions(mod.token);
        assert.deepEqual(modActions, ["post.remove"]);
        const modAll = await as(mod.token).get(`/api/admin/audit-logs?actor=${mod2.id}`);
        assert.equal(modAll.body.data.logs.length, 0, "a moderator cannot read another moderator's history");
        assert.equal((await as(mod.token).get("/api/admin/audit-logs?action=bogus")).status, 400);
    });
});

describe("dashboard and analytics", () => {
    it("returns real aggregated numbers and validates date ranges", async () => {
        const sa = await makeUser("superadmin");
        const author = await makeUser("user");
        const reader = await makeUser("user");
        const gone = await makeUser("user");
        await User.updateOne({ _id: gone.id }, { isDeleted: true, deletedAt: new Date() });
        const post = await makePost(author.user);
        await makePost(author.user, { status: "draft" });
        const removed = await makePost(author.user);
        await Post.updateOne({ _id: removed._id }, { isDeleted: true, deletedAt: new Date() });
        await Like.create({ user: reader.id, post: post._id });
        await comment(post, reader.user, "hi");
        await Report.create({ reporter: reader.id, targetType: "post", targetId: post._id, targetOwner: author.id, reason: "spam" });
        await Report.create({ reporter: author.id, targetType: "user", targetId: reader.id, targetOwner: reader.id, reason: "other", description: "x", status: "resolved", resolvedAt: new Date() });

        const stats = await as(sa.token).get("/api/admin/stats?range=7d");
        assert.equal(stats.status, 200, JSON.stringify(stats.body));
        const t = stats.body.data.totals;
        assert.equal(t.users, 4);
        assert.equal(t.activeUsers, 3);
        assert.equal(t.deletedUsers, 1);
        assert.equal(t.publishedPosts, 1);
        assert.equal(t.draftPosts, 1);
        assert.equal(t.deletedPosts, 1);
        assert.equal(t.comments, 1);
        assert.equal(t.likes, 1);
        assert.equal(t.superadmins, 1);
        assert.deepEqual(
            { total: stats.body.data.reports.total, pending: stats.body.data.reports.pending, resolved: stats.body.data.reports.resolved },
            { total: 2, pending: 1, resolved: 1 }
        );
        assert.equal(stats.body.data.recentSignups.length, 3);

        const trends = await as(sa.token).get("/api/admin/trends?range=7d");
        assert.equal(trends.status, 200);
        assert.equal(trends.body.data.registrations.length, 7);
        assert.equal(trends.body.data.registrations.reduce((n, d) => n + d.count, 0), 4);
        assert.equal(trends.body.data.engagement.reduce((n, d) => n + d.likes, 0), 1);

        const today = new Date().toISOString().slice(0, 10);
        const custom = await as(sa.token).get(`/api/admin/trends?range=custom&from=${today}&to=${today}`);
        assert.equal(custom.body.data.registrations.length, 1);
        assert.equal((await as(sa.token).get("/api/admin/trends?range=custom&from=2025-02-01&to=2025-01-01")).status, 400);
        assert.equal((await as(sa.token).get("/api/admin/trends?range=custom&from=2020-01-01&to=2025-01-01")).status, 400, "too long");
        assert.equal((await as(sa.token).get("/api/admin/trends?range=1y")).status, 400);

        const analytics = await as(sa.token).get("/api/admin/analytics?range=30d");
        assert.equal(analytics.status, 200, JSON.stringify(analytics.body));
        const d = analytics.body.data;
        assert.equal(d.accounts.deleted, 1);
        assert.equal(d.content.published, 1);
        assert.equal(d.popularPosts[0].title, post.title);
        assert.equal(d.popularPosts[0].likes, 1);
        assert.equal(d.moderation.reportsReceived, 2);
        assert.equal(d.moderation.resolutionRate, 50);
        assert.ok(d.reportsByReason.some((r) => r.reason === "spam" && r.count === 1));
        assert.equal(d.activeAuthors[0].username, author.user.username);
    });
});

describe("existing social features keep working", () => {
    it("23. feed, profile, follow, like, bookmark, comment and notifications", async () => {
        const alice = await makeUser("user");
        const bob = await makeUser("user");
        const post = await makePost(bob.user, { title: "Bob writes" });

        assert.equal((await as(alice.token).post(`/api/users/${bob.id}/follow`)).status < 300, true);
        assert.equal(await Follow.countDocuments({ follower: alice.id, following: bob.id }), 1);

        const feed = await as(alice.token).get("/api/feed/following");
        assert.equal(feed.status, 200);

        const posts = await api().get("/api/posts");
        assert.equal(posts.status, 200);
        assert.ok(JSON.stringify(posts.body).includes("Bob writes"));
        const single = await api().get(`/api/posts/${post._id}`);
        assert.equal(single.status, 200);
        assert.equal(single.body.data.commentsCount, 0);

        assert.equal((await as(alice.token).post(`/api/posts/${post._id}/like`)).status < 300, true);
        assert.equal(await Like.countDocuments({ post: post._id }), 1);
        assert.equal((await as(alice.token).post(`/api/posts/${post._id}/bookmark`)).status < 300, true);
        assert.equal(await Bookmark.countDocuments({ post: post._id }), 1);

        const added = await as(alice.token).post(`/api/posts/${post._id}/comments`, { content: "Great post" });
        assert.equal(added.status, 201);
        const counted = await api().get(`/api/posts/${post._id}`);
        assert.equal(counted.body.data.commentsCount, 1);
        const edited = await as(alice.token).put(`/api/comments/${added.body.data._id}`, { content: "Great post!" });
        assert.equal(edited.status, 200);
        assert.equal((await as(bob.token).put(`/api/comments/${added.body.data._id}`, { content: "hijack" })).status, 403);

        const notes = await as(bob.token).get("/api/notifications");
        assert.equal(notes.status, 200);
        assert.ok((await as(bob.token).get("/api/notifications/unread-count")).status === 200);

        const profile = await as(alice.token).get("/api/users/profile");
        assert.equal(profile.status, 200);
        assert.equal((await api().get(`/api/users/${bob.user.username}`)).status, 200);

        // author deleting their own post and restoring it
        assert.equal((await as(bob.token).delete(`/api/posts/${post._id}`)).status, 200);
        assert.equal((await api().get(`/api/posts/${post._id}`)).status, 404);
        assert.equal((await as(bob.token).patch(`/api/posts/${post._id}/restore`)).status, 200);
        assert.equal((await api().get(`/api/posts/${post._id}`)).status, 200);

        // someone else cannot delete it
        assert.equal((await as(alice.token).delete(`/api/posts/${post._id}`)).status, 403);
        const _ = await transactionsSupported();
        void _;
    });
});
