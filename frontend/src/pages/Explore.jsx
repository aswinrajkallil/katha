import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Flame,
  Sparkles,
  Video,
  Eye,
  MessageCircle,
  X,
  Compass,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";
import UserAvatar from "../components/UserAvatar";
import HorizontalScroller from "../components/HorizontalScroller";
import ConfirmDialog from "../components/ConfirmDialog";
import "./Explore.css";

export default function Explore() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // 1. Popular Authors State
  const [authors, setAuthors] = useState([]);
  const [authorsLoading, setAuthorsLoading] = useState(true);
  const [authorsError, setAuthorsError] = useState("");

  // 2. Trending Section State
  const [trending, setTrending] = useState([]);
  const [trendingLabel, setTrendingLabel] = useState("Trending this week");
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState("");

  // 3. All Posts Section State
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Filters
  const [sort, setSort] = useState("latest"); // "latest" | "mostViewed" | "mostCommented"
  const [hasVideo, setHasVideo] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null); // author object or null

  // Follow / Unfollow Confirmation State
  const [unfollowTarget, setUnfollowTarget] = useState(null);
  const [unfollowLoading, setUnfollowLoading] = useState(false);

  // Fetch Authors
  const fetchAuthors = useCallback(async () => {
    setAuthorsLoading(true);
    setAuthorsError("");
    try {
      const res = await apiFetch("/discover/authors");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load popular authors");
      }
      setAuthors(data.data || []);
    } catch (err) {
      setAuthorsError(err.message || "Unable to load authors");
    } finally {
      setAuthorsLoading(false);
    }
  }, []);

  // Fetch Trending
  const fetchTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError("");
    try {
      const res = await apiFetch("/discover/trending");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load trending posts");
      }
      setTrending(data.data.posts || []);
      if (data.data.label) {
        setTrendingLabel(data.data.label);
      }
    } catch (err) {
      setTrendingError(err.message || "Unable to load trending posts");
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  // Fetch All Posts
  const fetchPosts = useCallback(
    async (targetPage = 1, append = false) => {
      if (append) {
        setPostsLoadingMore(true);
      } else {
        setPostsLoading(true);
        setPostsError("");
      }

      try {
        let url = `/posts?page=${targetPage}&limit=10&sort=${sort}`;
        if (hasVideo) url += "&hasVideo=true";
        if (selectedAuthor?._id) url += `&author=${selectedAuthor._id}`;

        const res = await apiFetch(url);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load posts");
        }

        const newPosts = data.data.posts || [];
        setPagination(data.data.pagination || null);
        setPage(targetPage);

        if (append) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
      } catch (err) {
        setPostsError(err.message || "Unable to load posts");
      } finally {
        setPostsLoading(false);
        setPostsLoadingMore(false);
      }
    },
    [sort, hasVideo, selectedAuthor]
  );

  // Initial loads
  useEffect(() => {
    fetchAuthors();
    fetchTrending();
  }, [fetchAuthors, fetchTrending]);

  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  // Load More Posts
  const handleLoadMore = () => {
    if (!pagination || page >= pagination.totalPages || postsLoadingMore) return;
    fetchPosts(page + 1, true);
  };

  // Follow an author (optimistic)
  const handleFollowAuthor = async (author) => {
    if (!user) {
      toast.error("Please sign in to follow authors");
      return;
    }

    const authorId = author._id || author.id;
    // Optimistic toggle
    setAuthors((prev) =>
      prev.map((a) =>
        a._id === authorId
          ? {
              ...a,
              isFollowing: true,
              followersCount: (a.followersCount || 0) + 1,
            }
          : a
      )
    );

    try {
      const res = await apiFetch(`/users/${authorId}/follow`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`You are now following @${author.username}`);
      } else {
        // Rollback
        setAuthors((prev) =>
          prev.map((a) =>
            a._id === authorId
              ? {
                  ...a,
                  isFollowing: false,
                  followersCount: Math.max(0, (a.followersCount || 1) - 1),
                }
              : a
          )
        );
        toast.error(data.message || "Failed to follow author");
      }
    } catch {
      // Rollback
      setAuthors((prev) =>
        prev.map((a) =>
          a._id === authorId
            ? {
                ...a,
                isFollowing: false,
                followersCount: Math.max(0, (a.followersCount || 1) - 1),
              }
            : a
        )
      );
      toast.error("Network error while following");
    }
  };

  // Unfollow confirmation action (optimistic)
  const handleConfirmUnfollow = async () => {
    if (!unfollowTarget) return;
    setUnfollowLoading(true);

    const authorId = unfollowTarget._id || unfollowTarget.id;
    const authorUsername = unfollowTarget.username;

    // Optimistic toggle
    setAuthors((prev) =>
      prev.map((a) =>
        a._id === authorId
          ? {
              ...a,
              isFollowing: false,
              followersCount: Math.max(0, (a.followersCount || 1) - 1),
            }
          : a
      )
    );

    try {
      const res = await apiFetch(`/users/${authorId}/follow`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Unfollowed @${authorUsername}`);
        setUnfollowTarget(null);
      } else {
        // Rollback
        setAuthors((prev) =>
          prev.map((a) =>
            a._id === authorId
              ? {
                  ...a,
                  isFollowing: true,
                  followersCount: (a.followersCount || 0) + 1,
                }
              : a
          )
        );
        toast.error(data.message || "Failed to unfollow author");
      }
    } catch {
      // Rollback
      setAuthors((prev) =>
        prev.map((a) =>
          a._id === authorId
            ? {
                ...a,
                isFollowing: true,
                followersCount: (a.followersCount || 0) + 1,
              }
            : a
        )
      );
      toast.error("Network error while unfollowing");
    } finally {
      setUnfollowLoading(false);
    }
  };

  // Resolve cover image for trending cards
  const getCoverImageUrl = (coverImage) => {
    if (!coverImage) return null;
    if (coverImage.startsWith("data:") || coverImage.startsWith("blob:") || coverImage.startsWith("http")) {
      return coverImage;
    }
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    return `${baseUrl}${coverImage.startsWith("/") ? "" : "/"}${coverImage}`;
  };

  return (
    <main className="explore-container">
      {/* =========================================
          1. POPULAR AUTHORS ROW (Floating, no card)
      ========================================= */}
      <section className="explore-authors-section" aria-label="Popular authors">
        <div className="explore-section-header">
          <div className="explore-section-title-wrap">
            <span className="explore-section-icon">
              <Users size={16} />
            </span>
            <h2 className="explore-section-heading">Popular Authors</h2>
          </div>
        </div>

        {/* Loading Skeletons */}
        {authorsLoading && (
          <div style={{ display: "flex", gap: 14, overflowX: "hidden" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="explore-author-skeleton" />
            ))}
          </div>
        )}

        {/* Authors Error */}
        {!authorsLoading && authorsError && (
          <div className="explore-inline-error">
            <span>{authorsError}</span>
            <button
              type="button"
              className="explore-inline-retry-btn"
              onClick={fetchAuthors}
            >
              Retry
            </button>
          </div>
        )}

        {/* Authors Scroller */}
        {!authorsLoading && !authorsError && authors.length > 0 && (
          <HorizontalScroller gap={14} scrollStep={280} ariaLabel="Popular authors row">
            {authors.map((author) => {
              const currentUserId = user?._id || user?.id;
              const isSelf = Boolean(
                currentUserId && author._id && currentUserId.toString() === author._id.toString()
              );

              return (
                <div key={author._id} className="explore-author-card">
                  <Link
                    to={`/profile/${author.username}`}
                    className="explore-author-link"
                    title={`View @${author.username}'s profile`}
                  >
                    <UserAvatar user={author} size={52} />
                    <span className="explore-author-name">@{author.username}</span>
                    <span className="explore-author-stats">
                      {author.postCount} {author.postCount === 1 ? "story" : "stories"}
                    </span>
                    <span className="explore-author-stats" style={{ color: "#9ca3af" }}>
                      {author.followersCount || 0} followers
                    </span>
                  </Link>

                  {!isSelf && (
                    <button
                      type="button"
                      className={`explore-author-follow-btn ${
                        author.isFollowing ? "following" : "follow"
                      }`}
                      onClick={() => {
                        if (author.isFollowing) {
                          setUnfollowTarget(author);
                        } else {
                          handleFollowAuthor(author);
                        }
                      }}
                    >
                      {author.isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              );
            })}
          </HorizontalScroller>
        )}
      </section>

      {/* =========================================
          2. TRENDING SECTION
      ========================================= */}
      <section className="explore-trending-section" aria-label="Trending posts">
        <div className="explore-section-header">
          <div className="explore-section-title-wrap">
            <span className="explore-section-icon">
              <Flame size={16} />
            </span>
            <h2 className="explore-section-heading">{trendingLabel}</h2>
            <span className="explore-section-badge">Top picks</span>
          </div>
        </div>

        {/* Loading Skeletons */}
        {trendingLoading && (
          <div style={{ display: "flex", gap: 14, overflowX: "hidden" }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="explore-trending-skeleton" />
            ))}
          </div>
        )}

        {/* Trending Error */}
        {!trendingLoading && trendingError && (
          <div className="explore-inline-error">
            <span>{trendingError}</span>
            <button
              type="button"
              className="explore-inline-retry-btn"
              onClick={fetchTrending}
            >
              Retry
            </button>
          </div>
        )}

        {/* Trending Cards Scroller */}
        {!trendingLoading && !trendingError && trending.length > 0 && (
          <HorizontalScroller gap={14} scrollStep={300} ariaLabel="Trending stories">
            {trending.map((post, index) => {
              const imgUrl = getCoverImageUrl(post.coverImage);

              return (
                <div
                  key={post._id}
                  className="explore-trending-card"
                  onClick={() => navigate(`/post/${post._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/post/${post._id}`);
                    }
                  }}
                >
                  {/* Fixed Media Box with letterbox containment over blurred background copy */}
                  <div className="explore-trending-media-box">
                    <span className="explore-rank-badge">#{post.rank || index + 1}</span>

                    {imgUrl ? (
                      <>
                        <div
                          className="explore-trending-media-blur"
                          style={{ backgroundImage: `url(${imgUrl})` }}
                          aria-hidden="true"
                        />
                        <img
                          src={imgUrl}
                          alt=""
                          className="explore-trending-media-img"
                        />
                      </>
                    ) : (
                      <div className="explore-trending-media-fallback">
                        <Flame size={32} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="explore-trending-content">
                    <h3 className="explore-trending-title">{post.title}</h3>

                    <div className="explore-trending-meta">
                      <span className="explore-trending-author">
                        <UserAvatar user={post.author} size={18} />
                        <span>@{post.author?.username || "unknown"}</span>
                      </span>

                      <div className="explore-trending-stats">
                        <span title={`${post.views || 0} views`} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Eye size={13} />
                          {post.views || 0}
                        </span>
                        <span title={`${post.commentsCount || 0} comments`} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <MessageCircle size={13} />
                          {post.commentsCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </HorizontalScroller>
        )}
      </section>

      {/* =========================================
          3. ALL POSTS SECTION
      ========================================= */}
      <section className="explore-posts-section" aria-label="All published posts">
        {/* Sticky Sort and Filter Bar */}
        <div className="explore-sort-bar">
          <div className="explore-sort-group">
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
              className={`following-pill-btn ${sort === "mostViewed" ? "active" : ""}`}
              onClick={() => setSort("mostViewed")}
            >
              <span>Most viewed</span>
            </button>

            <button
              type="button"
              className={`following-pill-btn ${sort === "mostCommented" ? "active" : ""}`}
              onClick={() => setSort("mostCommented")}
            >
              <span>Most commented</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Active Author Filter Badge */}
            {selectedAuthor && (
              <span className="explore-author-filter-chip">
                <span>@{selectedAuthor.username}</span>
                <button
                  type="button"
                  className="explore-author-filter-clear"
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

        {/* Loading Skeletons */}
        {postsLoading && (
          <div className="explore-posts-stream">
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

        {/* Posts Error */}
        {!postsLoading && postsError && (
          <div className="following-error-card" role="alert">
            <h2 className="following-error-title">Unable to load stories</h2>
            <p style={{ color: "#718096", margin: "4px 0" }}>{postsError}</p>
            <button
              type="button"
              className="following-retry-btn"
              onClick={() => fetchPosts(1, false)}
            >
              <RefreshCw size={15} style={{ marginRight: 6, display: "inline" }} />
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!postsLoading && !postsError && posts.length === 0 && (
          <div className="following-empty-card">
            <div className="following-empty-icon">
              <Compass size={28} />
            </div>
            <h2 className="following-empty-title">No stories found</h2>
            <p className="following-empty-desc">
              {hasVideo || selectedAuthor
                ? "No stories match your current filters. Try resetting the filters."
                : "No published stories yet. Be the first to publish a story on Kathā!"}
            </p>
            {(hasVideo || selectedAuthor) ? (
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
            ) : (
              <Link to="/write" className="following-discover-btn">
                Write a story
              </Link>
            )}
          </div>
        )}

        {/* Post Stream */}
        {!postsLoading && !postsError && posts.length > 0 && (
          <div className="explore-posts-stream">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
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
                disabled={postsLoadingMore}
              >
                {postsLoadingMore ? "Loading stories..." : "Load more stories"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Unfollow Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(unfollowTarget)}
        title={unfollowTarget ? `Unfollow @${unfollowTarget.username}?` : "Unfollow author?"}
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
