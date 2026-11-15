import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Video,
  ArrowUp,
  X,
  Compass,
  RefreshCw,
  Sparkles,
  Inbox,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";
import UserAvatar from "../components/UserAvatar";
import ConfirmDialog from "../components/ConfirmDialog";
import HorizontalScroller from "../components/HorizontalScroller";
import "./FollowingFeed.css";

export default function FollowingFeed() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Feed State
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [followingCount, setFollowingCount] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Filters & Sorting
  const [sort, setSort] = useState("latest"); // "latest" | "views" | "comments"
  const [hasVideo, setHasVideo] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null); // author object or null

  // Suggested Users (for 0-following empty state)
  const [suggestions, setSuggestions] = useState([]);
  const [followingMap, setFollowingMap] = useState({}); // { [userId]: true }

  // New Posts Polling State
  const [newPostsCount, setNewPostsCount] = useState(0);

  // "See all" Modal & Unfollow Confirmation State
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [unfollowTarget, setUnfollowTarget] = useState(null);
  const [unfollowLoading, setUnfollowLoading] = useState(false);

  // LocalStorage Last-Visit for stories ring/dot
  const storageKey = `katha_following_last_visit_${user?._id || user?.id || "guest"}`;
  const [lastVisitTime] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number.parseInt(saved, 10) : 0;
  });

  // Update visit time when mounting
  useEffect(() => {
    const now = Date.now();
    // Keep lastVisitTime in state for comparison in this session, then update localStorage
    const timeout = setTimeout(() => {
      localStorage.setItem(storageKey, String(now));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [storageKey]);

  // Fetch Feed
  const fetchFeed = useCallback(
    async (targetPage = 1, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        let url = `/feed/following?page=${targetPage}&limit=10&sort=${sort}`;
        if (hasVideo) url += "&hasVideo=true";
        if (selectedAuthor?._id) url += `&author=${selectedAuthor._id}`;

        const res = await apiFetch(url);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || "Unable to load feed");
        }

        const newPosts = data.data.posts || [];
        const newPeople = data.data.people || [];
        const count = typeof data.data.followingCount === "number" ? data.data.followingCount : newPeople.length;

        setFollowingCount(count);
        setPeople(newPeople);
        setPagination(data.data.pagination);
        setPage(targetPage);

        if (append) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
          setNewPostsCount(0);
        }
      } catch (err) {
        setError(err.message || "Failed to load stories");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort, hasVideo, selectedAuthor]
  );

  // Initial and Filter change fetch
  useEffect(() => {
    fetchFeed(1, false);
  }, [fetchFeed]);

  // Fetch suggestions when user follows 0 people
  useEffect(() => {
    if (followingCount === 0) {
      apiFetch("/users/suggestions?limit=6")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSuggestions(data.data || []);
          }
        })
        .catch(() => {
          // If dedicated suggestions endpoint is not yet mounted, fallback to popular authors
          apiFetch("/discover/authors")
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                setSuggestions(data.data || []);
              }
            })
            .catch(() => {});
        });
    }
  }, [followingCount]);

  // Background Polling for New Posts (every 60s, pauses when tab is hidden)
  useEffect(() => {
    if (page !== 1 || !posts.length || followingCount === 0) return;

    const interval = setInterval(async () => {
      if (document.hidden) return;

      try {
        let url = `/feed/following?page=1&limit=5&sort=${sort}`;
        if (hasVideo) url += "&hasVideo=true";
        if (selectedAuthor?._id) url += `&author=${selectedAuthor._id}`;

        const res = await apiFetch(url);
        const data = await res.json();
        if (res.ok && data.success && data.data.posts?.length) {
          const latestFetched = data.data.posts;
          const currentTopId = posts[0]?._id;
          if (currentTopId && latestFetched[0]?._id !== currentTopId) {
            // Count how many new posts arrived
            const newIndex = latestFetched.findIndex((p) => p._id === currentTopId);
            const count = newIndex > 0 ? newIndex : latestFetched.length;
            setNewPostsCount(count);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [page, posts, followingCount, sort, hasVideo, selectedAuthor]);

  // Handle Loading More (Pagination)
  const handleLoadMore = () => {
    if (!pagination || page >= pagination.totalPages || loadingMore) return;
    fetchFeed(page + 1, true);
  };

  // Follow a suggested user
  const handleFollowUser = async (targetUser) => {
    const targetId = targetUser._id || targetUser.id;
    if (!targetId) return;

    try {
      const res = await apiFetch(`/users/${targetId}/follow`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFollowingMap((prev) => ({ ...prev, [targetId]: true }));
        toast.success(`Following @${targetUser.username}`);
        // Refresh feed so new stories appear
        fetchFeed(1, false);
      } else {
        toast.error(data.message || "Failed to follow user");
      }
    } catch {
      toast.error("Network error while following");
    }
  };

  // Unfollow confirmation action
  const handleConfirmUnfollow = async () => {
    if (!unfollowTarget) return;
    setUnfollowLoading(true);

    const targetId = unfollowTarget._id || unfollowTarget.id;
    try {
      const res = await apiFetch(`/users/${targetId}/follow`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Unfollowed @${unfollowTarget.username}`);
        // Remove from local people list
        setPeople((prev) => prev.filter((p) => p._id !== targetId));
        setFollowingCount((prev) => Math.max(0, (prev || 1) - 1));
        // Remove their posts from current stream
        setPosts((prev) => prev.filter((post) => post.author?._id !== targetId));
        // If selected author was unfollowed, reset filter
        if (selectedAuthor?._id === targetId) {
          setSelectedAuthor(null);
        }
        setUnfollowTarget(null);
      } else {
        toast.error(data.message || "Failed to unfollow user");
      }
    } catch {
      toast.error("Network error while unfollowing");
    } finally {
      setUnfollowLoading(false);
    }
  };

  return (
    <main className="following-feed-container">
      {/* 1. "People you follow" Strip (floating, no card container) */}
      {people.length > 0 && (
        <section className="following-people-section" aria-label="People you follow">
          <div className="following-people-header">
            <h2 className="following-people-heading">PEOPLE YOU FOLLOW</h2>
            <button
              type="button"
              className="following-see-all-btn"
              onClick={() => setSeeAllOpen(true)}
            >
              See all ({followingCount || people.length})
            </button>
          </div>

          <HorizontalScroller gap={14} scrollStep={240} ariaLabel="People you follow">
            {/* "All" item to clear filter */}
            <button
              type="button"
              className={`following-person-item ${!selectedAuthor ? "selected" : ""}`}
              onClick={() => setSelectedAuthor(null)}
              title="All followed stories"
            >
              <div
                className={`following-avatar-ring-wrap ${
                  !selectedAuthor ? "active-filter" : ""
                }`}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: !selectedAuthor ? "#ffedd5" : "#f3f4f6",
                    color: !selectedAuthor ? "#e8590c" : "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  All
                </div>
              </div>
              <span className="following-person-name">All Stories</span>
            </button>

            {/* People Cards */}
            {people.map((person) => {
              const hasNewPost =
                person.latestPostAt &&
                new Date(person.latestPostAt).getTime() > lastVisitTime;
              const isSelected = selectedAuthor?._id === person._id;

              return (
                <div
                  key={person._id}
                  className={`following-person-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    if (person.username) {
                      navigate(`/profile/${person.username}`);
                    } else {
                      setSelectedAuthor(person);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/profile/${person.username}`);
                    }
                  }}
                  title={`View @${person.username}'s profile`}
                >
                  <div
                    className={`following-avatar-ring-wrap ${
                      hasNewPost ? "has-new" : ""
                    } ${isSelected ? "active-filter" : ""}`}
                  >
                    <UserAvatar user={person} size={48} />
                    {hasNewPost && <span className="following-new-dot" />}
                  </div>
                  <span className="following-person-name">@{person.username}</span>
                </div>
              );
            })}
          </HorizontalScroller>
        </section>
      )}

      {/* 3. Sticky Sort and Filter Bar */}
      {followingCount !== 0 && (
        <div className="following-filter-bar">
          <div className="following-sort-group">
            <button
              type="button"
              className={`following-pill-btn ${sort === "latest" ? "active" : ""}`}
              onClick={() => setSort("latest")}
            >
              <Sparkles size={14} />
              <span>Latest</span>
            </button>

            <button
              type="button"
              className={`following-pill-btn ${sort === "views" ? "active" : ""}`}
              onClick={() => setSort("views")}
            >
              <span>Most viewed</span>
            </button>

            <button
              type="button"
              className={`following-pill-btn ${sort === "comments" ? "active" : ""}`}
              onClick={() => setSort("comments")}
            >
              <span>Most commented</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Active Author Filter Badge */}
            {selectedAuthor && (
              <span className="following-author-filter-badge">
                <span>@{selectedAuthor.username}</span>
                <button
                  type="button"
                  className="following-author-filter-clear"
                  onClick={() => setSelectedAuthor(null)}
                  aria-label="Clear author filter"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {/* Has Video Toggle */}
            <button
              type="button"
              className={`following-filter-toggle ${hasVideo ? "active" : ""}`}
              onClick={() => setHasVideo((prev) => !prev)}
              aria-pressed={hasVideo}
            >
              <Video size={15} />
              <span>Has video</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Floating "N New Posts" Button */}
      {newPostsCount > 0 && (
        <button
          type="button"
          className="following-floating-new-posts"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            fetchFeed(1, false);
          }}
        >
          <ArrowUp size={16} />
          <span>
            {newPostsCount} new {newPostsCount === 1 ? "story" : "stories"} available
          </span>
        </button>
      )}

      {/* 5. Skeleton Loaders while initial loading */}
      {loading && (
        <div className="following-posts-stream">
          {[1, 2, 3].map((n) => (
            <div key={n} className="following-skeleton-card">
              <div className="following-skeleton-header">
                <div className="following-skeleton-avatar" />
                <div className="following-skeleton-pill" />
              </div>
              <div className="following-skeleton-title" />
              <div className="following-skeleton-body" />
              <div className="following-skeleton-media" />
            </div>
          ))}
        </div>
      )}

      {/* 6. Error State */}
      {!loading && error && (
        <div className="following-error-card" role="alert">
          <h2 className="following-error-title">Unable to load stories</h2>
          <p style={{ color: "#718096", margin: "4px 0" }}>{error}</p>
          <button
            type="button"
            className="following-retry-btn"
            onClick={() => fetchFeed(1, false)}
          >
            <RefreshCw size={15} style={{ marginRight: 6, display: "inline" }} />
            Retry
          </button>
        </div>
      )}

      {/* 7. Empty State: User follows nobody (followingCount === 0) */}
      {!loading && !error && followingCount === 0 && (
        <div className="following-empty-card">
          <div className="following-empty-icon">
            <Users size={28} />
          </div>
          <h2 className="following-empty-title">Your feed is empty</h2>
          <p className="following-empty-desc">
            Follow people to see their stories, ideas, and videos in this feed.
          </p>
          <Link to="/explore" className="following-discover-btn">
            <Compass size={16} />
            <span>Discover people</span>
          </Link>

          {/* Suggested people to follow */}
          {suggestions.length > 0 && (
            <div className="following-suggested-section">
              <h3 className="following-suggested-heading">
                Suggested people to follow
              </h3>
              <div className="following-suggested-list">
                {suggestions.map((sug) => {
                  const targetId = sug._id || sug.id;
                  const isFollowed = Boolean(followingMap[targetId]);

                  return (
                    <div key={targetId} className="following-suggested-item">
                      <Link
                        to={`/profile/${sug.username}`}
                        className="following-suggested-user-info"
                      >
                        <UserAvatar user={sug} size={38} />
                        <div className="following-suggested-meta">
                          <span className="following-suggested-name">
                            @{sug.username}
                          </span>
                          <span className="following-suggested-bio">
                            {sug.bio || sug.fullName || `${sug.postCount || 0} stories`}
                          </span>
                        </div>
                      </Link>

                      <button
                        type="button"
                        className={`following-suggest-follow-btn ${
                          isFollowed ? "followed" : ""
                        }`}
                        onClick={() => !isFollowed && handleFollowUser(sug)}
                        disabled={isFollowed}
                      >
                        {isFollowed ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <UserCheck size={14} /> Following
                          </span>
                        ) : (
                          "Follow"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Empty State: User follows people, but 0 posts match */}
      {!loading && !error && followingCount > 0 && posts.length === 0 && (
        <div className="following-empty-card">
          <div className="following-empty-icon" style={{ background: "#f3f4f6", color: "#6b7280" }}>
            <Inbox size={28} />
          </div>
          <h2 className="following-empty-title">No new stories yet</h2>
          <p className="following-empty-desc">
            {hasVideo || selectedAuthor
              ? "No stories match your current filters. Try resetting the filters to view all stories."
              : "No stories have been posted yet by the people you follow."}
          </p>
          {(hasVideo || selectedAuthor) && (
            <button
              type="button"
              className="following-pill-btn"
              onClick={() => {
                setHasVideo(false);
                setSelectedAuthor(null);
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* 9. Posts Stream */}
      {!loading && !error && posts.length > 0 && (
        <div className="following-posts-stream">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              showFollowingBadge={true}
              onDelete={(deletedId) =>
                setPosts((prev) => prev.filter((p) => p._id !== deletedId))
              }
            />
          ))}

          {/* Load More Button */}
          {pagination && page < pagination.totalPages && (
            <button
              type="button"
              className="following-load-more-btn"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading stories..." : "Load more stories"}
            </button>
          )}
        </div>
      )}

      {/* 10. "See all" Modal Drawer */}
      {seeAllOpen && (
        <div
          className="following-modal-backdrop"
          onClick={() => setSeeAllOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="following-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="following-modal-header">
              <h2 className="following-modal-title">
                Following ({people.length})
              </h2>
              <button
                type="button"
                className="following-modal-close-btn"
                onClick={() => setSeeAllOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="following-modal-list">
              {people.map((person) => (
                <div key={person._id} className="following-modal-item">
                  <Link
                    to={`/profile/${person.username}`}
                    className="following-suggested-user-info"
                    onClick={() => setSeeAllOpen(false)}
                  >
                    <UserAvatar user={person} size={40} />
                    <div className="following-suggested-meta">
                      <span className="following-suggested-name">
                        @{person.username}
                      </span>
                      <span className="following-suggested-bio">
                        {person.fullName || person.bio || "Writer"}
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    className="following-unfollow-btn"
                    onClick={() => setUnfollowTarget(person)}
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unfollow Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(unfollowTarget)}
        title={unfollowTarget ? `Unfollow @${unfollowTarget.username}?` : "Unfollow user?"}
        message="You will no longer see stories and updates from this author in your Following feed."
        confirmText="Unfollow"
        cancelText="Cancel"
        loading={unfollowLoading}
        onConfirm={handleConfirmUnfollow}
        onClose={() => setUnfollowTarget(null)}
      />
    </main>
  );
}
