import { QueryClient, keepPreviousData } from "@tanstack/react-query";

/**
 * Global QueryClient configured with:
 * - default staleTime: 60 seconds
 * - gcTime: 10 minutes
 * - retry: once, never on 4xx client errors
 * - placeholderData: keepPreviousData for smooth pagination
 * - window focus refetch: disabled by default (enabled on notifications/feed)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      placeholderData: keepPreviousData,
    },
  },
});

/**
 * Standard Query Key Factory for Kathā
 */
export const queryKeys = {
  me: () => ["me"],
  profile: (id) => ["profile", String(id || "").toLowerCase()],
  posts: (filters = {}) => ["posts", filters],
  post: (id) => ["post", String(id || "")],
  comments: (postId, sort = "best") => ["comments", String(postId || ""), sort],
  bookmarks: () => ["bookmarks"],
  notifications: () => ["notifications"],
  unreadCount: () => ["notifications", "unreadCount"],
  followingFeed: (filters = {}) => ["feed", "following", filters],
  trending: (type = "all") => ["discover", "trending", type],
  popularAuthors: () => ["discover", "authors"],
  suggestions: () => ["suggestions"],
  followers: (id) => ["connections", "followers", String(id || "")],
  following: (id) => ["connections", "following", String(id || "")],
  categories: () => ["categories"],
};

/**
 * Patch a post across all active cached lists and details.
 * Ensures a single source of truth without full refetches.
 *
 * @param {QueryClient} qc
 * @param {string} postId
 * @param {function} updater Receives post and returns updated post
 */
export function patchPostEverywhere(qc, postId, updater) {
  if (!postId || typeof updater !== "function") return;
  const targetId = String(postId);

  // 1. Single post detail query
  qc.setQueryData(queryKeys.post(targetId), (old) => {
    if (!old) return old;
    return updater(old);
  });

  // 2. All lists under 'posts' (home, author posts, my posts)
  qc.setQueriesData({ queryKey: ["posts"] }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((p) => (String(p._id) === targetId ? updater(p) : p));
    }
    if (Array.isArray(old.posts)) {
      return {
        ...old,
        posts: old.posts.map((p) => (String(p._id) === targetId ? updater(p) : p)),
      };
    }
    return old;
  });

  // 3. Following feed queries
  qc.setQueriesData({ queryKey: ["feed"] }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((p) => (String(p._id) === targetId ? updater(p) : p));
    }
    if (Array.isArray(old.posts)) {
      return {
        ...old,
        posts: old.posts.map((p) => (String(p._id) === targetId ? updater(p) : p)),
      };
    }
    return old;
  });

  // 4. Bookmarks
  qc.setQueriesData({ queryKey: ["bookmarks"] }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((p) => (String(p._id) === targetId ? updater(p) : p));
    }
    if (Array.isArray(old.bookmarks)) {
      return {
        ...old,
        bookmarks: old.bookmarks.map((b) =>
          b.post && String(b.post._id) === targetId
            ? { ...b, post: updater(b.post) }
            : b
        ),
      };
    }
    return old;
  });

  // 5. Discover / trending
  qc.setQueriesData({ queryKey: ["discover"] }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((p) => (String(p._id) === targetId ? updater(p) : p));
    }
    if (Array.isArray(old.posts)) {
      return {
        ...old,
        posts: old.posts.map((p) => (String(p._id) === targetId ? updater(p) : p)),
      };
    }
    return old;
  });
}

/**
 * Seeds a post into ['post', id] cache if not present, making detail view instant.
 */
export function seedPost(qc, post) {
  if (!post?._id) return;
  qc.setQueryData(queryKeys.post(post._id), (existing) => existing || post);
}

export default queryClient;
