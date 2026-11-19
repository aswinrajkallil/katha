import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import apiFetch from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

/**
 * One place that talks to the follow API and keeps every cache in sync.
 *
 * Why this exists: follow state used to live separately in the profile page, the right
 * panel, the feed and Explore. Following someone from one place left the others stale,
 * so the profile button then sent a second "follow" (409 Already following) instead of
 * an unfollow. This hook:
 *   - treats 409 on follow and 404 on unfollow as "already in the desired state"
 *   - updates every cached profile for the target (isFollowing + follower count)
 *   - updates the current user's own following count
 *   - refreshes the left-panel "Following" list and the following feed
 *
 * follow(target, shouldFollow) resolves to { isFollowing, followers } or null on failure.
 * Callers do their own optimistic UI and roll back when it resolves to null.
 */
export default function useFollowToggle() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set());
  const [pendingIds, setPendingIds] = useState([]);

  const meId = user?._id || user?.id || null;

  const syncCaches = useCallback(
    (targetId, isFollowing, followers, changed) => {
      queryClient.setQueriesData({ queryKey: ["profile"] }, (old) => {
        if (!old || typeof old !== "object" || !old._id) return old;
        if (String(old._id) === String(targetId)) {
          return {
            ...old,
            isFollowing,
            stats: {
              ...old.stats,
              followers: typeof followers === "number" ? followers : old.stats?.followers ?? 0,
            },
          };
        }
        // My own profile: my "following" count moved by one
        if (changed && meId && String(old._id) === String(meId)) {
          const current = old.stats?.following ?? 0;
          return {
            ...old,
            stats: { ...old.stats, following: Math.max(0, current + (isFollowing ? 1 : -1)) },
          };
        }
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ["connections"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      // Mark the right-hand panel stale without refetching now, so a just-followed
      // author does not vanish from "Who to follow" while the user is still looking at it.
      queryClient.invalidateQueries({ queryKey: ["posts", "sidebar"], refetchType: "none" });
    },
    [queryClient, meId]
  );

  const follow = useCallback(
    async (target, shouldFollow) => {
      const targetId = target?._id || target?.id;
      if (!targetId) return null;

      if (!user) {
        navigate("/login");
        return null;
      }
      if (inFlight.current.has(String(targetId))) return null;

      inFlight.current.add(String(targetId));
      setPendingIds((ids) => [...ids, String(targetId)]);

      const handle = target.username ? `@${target.username}` : "this user";

      try {
        const res = await apiFetch(`/users/${targetId}/follow`, {
          method: shouldFollow ? "POST" : "DELETE",
        });
        const data = await res.json().catch(() => ({}));

        // Already in the state we wanted: the UI was just out of date, so treat it as success.
        const alreadyDone = shouldFollow ? res.status === 409 : res.status === 404;
        if (!alreadyDone && (!res.ok || data.success === false)) {
          throw new Error(
            data.message || (shouldFollow ? "Couldn't follow. Please try again." : "Couldn't unfollow. Please try again.")
          );
        }

        const followers = typeof data?.data?.followers === "number" ? data.data.followers : undefined;
        syncCaches(targetId, shouldFollow, followers, !alreadyDone);

        toast.success(shouldFollow ? `You are now following ${handle}` : `Unfollowed ${handle}`);
        return { isFollowing: shouldFollow, followers };
      } catch (err) {
        toast.error(err?.message || "Network error. Please try again.");
        return null;
      } finally {
        inFlight.current.delete(String(targetId));
        setPendingIds((ids) => ids.filter((id) => id !== String(targetId)));
      }
    },
    [user, navigate, toast, syncCaches]
  );

  const isPending = useCallback((id) => pendingIds.includes(String(id)), [pendingIds]);

  return { follow, isPending };
}
