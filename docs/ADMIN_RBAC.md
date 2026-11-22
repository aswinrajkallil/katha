# Admin RBAC, Super Admin and Moderation

## Roles

| Role | Purpose |
| --- | --- |
| `superadmin` | Owns the platform. Manages staff roles and platform settings. Not assignable through the API. |
| `admin` | Runs the platform day to day: users, posts, comments, reports, categories, featured posts, analytics. |
| `moderator` | Reviews content and reports only. |
| `user` | Everyone else. **This is the only role self-registration can produce.** |

Authorization is always checked against the database on every request (`authenticate` reloads the
account). The role inside the JWT is never trusted, so a demoted or deactivated account loses access
immediately, even with a valid, unexpired token.

## Permission matrix

| Capability | Super Admin | Admin | Moderator |
| --- | :-: | :-: | :-: |
| Dashboard, analytics | yes | yes | no |
| View / deactivate / restore / permanently delete users (below own level) | yes | yes | no |
| Grant or remove admin / moderator roles | yes | no | no |
| Platform settings (open registration) | yes | no | no |
| View posts, remove and restore posts | yes | yes | yes (normal users' content; reason required) |
| Edit, publish/unpublish, feature, permanently delete posts | yes | yes | no |
| View, remove and restore comments | yes | yes | yes (normal users' content; reason required) |
| Permanently delete comments | yes | yes | no |
| View and work reports | yes | yes | yes (unassigned or own reports) |
| Categories, featured posts | yes | yes | no |
| Activity log | everything | everything except role/setting/system entries | own moderation and report actions |

Hierarchy rules enforced by the API: nobody can act on an account at or above their own level;
moderators only act on content by normal users; admins cannot act on a Super Admin's content; nobody
can change their own role; a Super Admin role cannot be granted or removed through the API.

## Provisioning the first Super Admin

There is deliberately no public endpoint for this. It is a one-time command run by someone with
server access and database credentials:

1. The person registers a normal account through the site.
2. On the server (with `MONGO_URI` set), preview the change:
   `npm run provision:superadmin -- --email person@example.com`
3. Apply it:
   `npm run provision:superadmin -- --email person@example.com --apply`

Behaviour: dry run by default; the account must already exist and be active; it is idempotent; it
refuses to create a second Super Admin unless `--allow-additional` is passed; it never changes any
other account; and it records an audit entry (actor `system`). No password is created or stored.
`scripts/createAdmin.js` is retired and exits with instructions.

After that, the Super Admin grants `admin` and `moderator` roles from **Admin → Admin Management**.

## Database migration

No data migration is required. New fields are optional with safe defaults, and indexes are created
by Mongoose on startup (`autoIndex`); on large production collections create them during a quiet
period. Existing `role: "admin"` accounts keep working as Admins. Existing comments get
`isDeleted: false` semantics unchanged. Collections added: `adminauditlogs`, `reports`,
`postrevisions`, `platformsettings`.

Multi-step actions (for example removing a post and writing its audit entry) run in a transaction
when MongoDB is a replica set or sharded cluster; on a standalone server they run sequentially and
the audit write is logged loudly if it fails.

## Endpoints

All under `/api/admin` and require staff authentication plus the permission shown in the matrix.

- Dashboard: `GET /stats`, `GET /trends`, `GET /analytics` (`range=7d|30d|90d|custom&from=&to=`)
- Users: `GET /users`, `GET /users/:id`, `GET /users/:id/posts`, `DELETE /users/:id`, `PATCH /users/:id/restore`, `DELETE /users/:id/permanent`
- Posts: `GET /posts`, `PATCH /posts/:id`, `PATCH /posts/:id/status`, `PATCH /posts/:id/feature`, `GET /posts/:id/history`, `DELETE /posts/:id`, `PATCH /posts/:id/restore`, `DELETE /posts/:id/permanent`
- Featured: `GET /featured`, `PUT /featured/order`
- Comments: `GET /comments`, `GET /comments/:id`, `DELETE /comments/:id`, `PATCH /comments/:id/restore`, `DELETE /comments/:id/permanent`
- Reports: `GET /reports`, `GET /reports/:id`, `PATCH /reports/:id/assign`, `POST /reports/:id/resolve`
- Activity log: `GET /audit-logs` (any other method returns 405: the log is append-only)
- Super Admin: `GET /management/staff`, `PATCH /management/users/:id/role`, `GET|PATCH /settings`

Public: `POST /api/reports` (signed in, rate limited), `GET /api/posts/featured`,
`GET /api/categories?withCounts=true`. Category writes (`/api/categories`) need `categories:manage`.

## Tests

`npm test` in `backend/` uses a throwaway database (default `mongodb://127.0.0.1:27099/katha_test`,
override with `TEST_MONGO_URI`). The helpers refuse to run against any database whose name does not
contain "test", so production data cannot be touched.
