# Kathā social platform features

This branch adds the next social-platform foundation on top of the existing posts, comments, likes, bookmarks and authentication features.

## Included

### Profiles
- Public profile lookup by username or MongoDB ID.
- Profile editing for username, full name, bio, location, website and avatar.
- Separate cover-image upload endpoint.
- Public profile stats for published posts, followers and following.
- Public profile data does not expose email, password or refresh-token fields.
- Published author posts are paginated.

### Follow system
- Follow and unfollow endpoints.
- Self-follow and duplicate-follow protection.
- Paginated follower and following lists.
- Follow status is included in public profile responses for authenticated viewers.
- A follow notification is generated for the followed user.

### Personalized feed
- Authenticated endpoint returns published posts from followed authors.
- Newest-first ordering and pagination.

### Notifications
- Follow, like and comment notifications.
- Authenticated notification list with unread count.
- Mark one or all notifications read.
- Delete a notification.
- A user does not receive a notification for liking or commenting on their own post.

### Search and discovery
- Search users by username/full name and posts by title, excerpt, content or tags.
- Input is length-limited and escaped before building a regular expression.
- Trending posts are ranked by likes in a configurable recent time window.
- Popular authors are ranked by published post count.

### Baseline security improvements
- Refresh tokens are SHA-256 hashed before storage. Existing plaintext refresh tokens are accepted once for migration and are converted to hashes on refresh.
- Login and registration use a per-process rate limiter.
- Uploaded image content is checked against JPEG, PNG, GIF or WebP file signatures.
- Basic security response headers are set.
- API JSON body size is limited.
- Startup fails if JWT secrets are missing.

## API overview

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| GET | `/api/users/:usernameOrId` | Optional | Public profile and counts |
| GET | `/api/users/profile` | Required | Current user's private profile data |
| PUT | `/api/users/profile` | Required | Update profile and avatar |
| PUT | `/api/users/profile/cover` | Required | Update cover image |
| GET | `/api/users/:id/posts` | Public | Paginated published posts |
| POST | `/api/users/:userId/follow` | Required | Follow a user |
| DELETE | `/api/users/:userId/follow` | Required | Unfollow a user |
| GET | `/api/users/:userId/followers` | Public | Paginated followers |
| GET | `/api/users/:userId/following` | Public | Paginated following |
| GET | `/api/feed/following` | Required | Personalized feed |
| GET | `/api/notifications` | Required | Notifications and unread count |
| PATCH | `/api/notifications/:id/read` | Required | Mark one notification read |
| PATCH | `/api/notifications/read-all` | Required | Mark all notifications read |
| DELETE | `/api/notifications/:id` | Required | Delete notification |
| GET | `/api/search?q=term` | Public | Search users and posts |
| GET | `/api/discover/trending` | Public | Trending posts |
| GET | `/api/discover/authors` | Public | Popular authors |

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set real MongoDB and JWT secrets.
2. Copy `frontend/.env.example` to `frontend/.env` and set the API URL.
3. Install dependencies in both folders with `npm install`.
4. Start the backend with `npm run dev` from `backend/`.
5. Start the frontend with `npm run dev` from `frontend/`.

Generate separate random JWT secrets. Do not commit real `.env` files.

## Manual verification checklist

- Register two accounts with distinct usernames and emails.
- Confirm duplicate email and duplicate username are rejected.
- Edit the first account's name, bio, location, website and avatar.
- Upload an invalid/non-image file and confirm it is rejected.
- Open each user's profile while logged in and logged out.
- Follow and unfollow between the two accounts; verify counts and notifications.
- Create a published post as one account and like/comment as the other.
- Confirm the post owner receives the relevant notifications.
- Mark notifications read individually and all at once.
- Confirm the following feed includes posts from followed authors and excludes unrelated authors.
- Search for both an author and a post.
- Check trending and popular-author sections.
- Verify pagination and ensure drafts are not visible on public profile/feed/search.

## Important deployment notes / remaining hardening

- The included rate limiter uses process memory. Replace it with a shared store such as Redis before running multiple server instances.
- Use HTTPS in production and configure the exact frontend origin.
- Review CSRF protections if the frontend and API are deployed on different sites; keep cookie SameSite/Secure settings aligned with the deployment topology.
- Add automated integration tests against a disposable MongoDB database and run frontend lint/build before merging.
- Existing MongoDB data should be checked for duplicate usernames before the new unique username index is deployed. Resolve duplicates before index creation if necessary.
- Image files are validated by signature, but production storage should move to object storage/CDN with malware scanning and cleanup of replaced files.
- Private-account approval flows, real-time Socket.IO notifications, notification grouping, recommendation ranking and advanced full-text search are not included in this iteration.
- Trending is currently like-count based; it is a simple first ranking strategy, not an engagement-quality recommendation algorithm.
