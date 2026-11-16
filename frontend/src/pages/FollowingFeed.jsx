import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Video,
  ArrowUp,
  X,
  Compass,
  RefreshCw,
  Inbox,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";
import UserAvatar from "../components/UserAvatar";
import ConfirmDialog from "../components/ConfirmDialog";
import HorizontalScroller from "../components/HorizontalScroller";
import AuthorStripItem from "../components/AuthorStripItem";
import SortBar, { buildFeedQueryUrl } from "../components/SortBar";
import "./FollowingFeed.css";

export default function FollowingFeed() {
  const { user } = useAuth();
  const { socket } = useSocket();
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
  const [sort, setSort] = useState("latest"); // "latest" | "mostViewed" | "mostCommented"
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
    const timeout = setTimeout(() => {
      localStorage.setItem(storageKey, String(now));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [storageKey]);

  // Fetch Feed with signal to abort stale requests
  const fetchFeed = useCallback(
    async (targetPage = 1, append = false, signal = null) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const url = buildFeedQueryUrl("/feed/following", {
          page: targetPage,
          limit: 10,
          sort,
          hasVideo,
          authorId: selectedAuthor?._id || null,
        });

        const res = await apiFetch(url, { signal });
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
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load stories");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort, hasVideo, selectedAuthor]
  );

  // Initial & Filter change fetch with AbortController
  useEffect(() => {
    const controller = new AbortController();
    fetchFeed(1, false, controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchFeed]);

  // Handle Sort Change (reset to page 1 & scroll)
  const handleSortChange = (newSort) => {
    setSort(newSort);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle Has Video Toggle (reset to page 1 & scroll)
  const handleHasVideoToggle = () => {
    setHasVideo((v) => !v);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle Clear Author filter
  const handleClearAuthor = () => {
    setSelectedAuthor(null);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  // Realtime New Posts notification via Socket (replaces 60s polling)
  useEffect(() => {
    if (!socket) return;

    const handlePostCreated = (data) => {
      const myId = user?._id || user?.id;
      // Don't show pill for own posts
      if (!data?.post || data.authorId === myId) return;

      // Only show if the post author is followed or if user follows anyone
      const isAuthorFollowed = people.some((p) => (p._id || p.id) === data.authorId);
      if (isAuthorFollowed || followingCount > 0) {
        setNewPostsCount((prev) => prev + 1);
      }
    };

    socket.on("post:created", handlePostCreated);
    return () => {
      socket.off("post:created", handlePostCreated);
    };
  }, [socket, user, people, followingCount]);

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
        setPeople((prev) => prev.filter((p) => p._id !== targetId));
        setFollowingCount((prev) => Math.max(0, (prev || 1) - 1));
        setPosts((prev) => prev.filter((post) => post.author?._id !== targetId));
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
              onClick={handleClearAuthor}
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

            {/* Shared AuthorStripItem for followed authors */}
            {people.map((person) => {
              const hasNewPost =
                person.latestPostAt &&
                new Date(person.latestPostAt).getTime() > lastVisitTime;
              const isSelected = selectedAuthor?._id === person._id;

              return (
                <AuthorStripItem
                  key={person._id}
                  author={person}
                  hasNewPost={hasNewPost}
                  isSelected={isSelected}
                  onClick={() => {
                    if (person.username) {
                      navigate(`/profile/${person.username}`);
                    } else {
                      setSelectedAuthor(person);
                    }
                  }}
                />
              );
            })}
          </HorizontalScroller>
        </section>
      )}

      {/* 2. Shared Sticky Sort and Filter Bar */}
      {followingCount !== 0 && (
        <SortBar
          sort={sort}
          onSortChange={handleSortChange}
          hasVideo={hasVideo}
          onHasVideoToggle={handleHasVideoToggle}
          selectedAuthor={selectedAuthor}
          onClearAuthor={handleClearAuthor}
        />
      )}

      {/* 3. Floating "N New Posts" Button */}
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

      {/* 4. Skeleton Loaders while initial loading */}
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

      {/* 5. Error State */}
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

      {/* 6. Empty State: User follows nobody (followingCount === 0) */}
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

      {/* 7. Dedicated Empty State: Has Video toggle returns 0 posts */}
      {!loading && !error && followingCount > 0 && posts.length === 0 && hasVideo && (
        <div className="following-empty-card">
          <div className="following-empty-icon" style={{ background: "#ffedd5", color: "#e8590c" }}>
            <Video size={28} />
          </div>
          <h2 className="following-empty-title">No video posts yet</h2>
          <p className="following-empty-desc">
            None of the people you follow have published stories with videos yet.
          </p>
          <button
            type="button"
            className="following-pill-btn active"
            onClick={handleHasVideoToggle}
          >
            Show all stories
          </button>
        </div>
      )}

      {/* 8. Empty State: User follows people, but 0 general posts match */}
      {!loading && !error && followingCount > 0 && posts.length === 0 && !hasVideo && (
        <div className="following-empty-card">
          <div className="following-empty-icon" style={{ background: "#f3f4f6", color: "#6b7280" }}>
            <Inbox size={28} />
          </div>
          <h2 className="following-empty-title">No new stories yet</h2>
          <p className="following-empty-desc">
            {selectedAuthor
              ? "No stories match your current author filter. Try resetting the filter to view all stories."
              : "No stories have been posted yet by the people you follow."}
          </p>
          {selectedAuthor && (
            <button
              type="button"
              className="following-pill-btn"
              onClick={handleClearAuthor}
            >
              Reset filter
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
