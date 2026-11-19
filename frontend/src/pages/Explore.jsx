import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Flame,
  Video,
  Play,
  Eye,
  MessageCircle,
  Compass,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useQueryClient } from "@tanstack/react-query";
import apiFetch from "../api/api";
import { queryKeys, patchFollowState } from "../api/queryClient";
import PostCard from "../components/Posts/PostCard";
import UserAvatar from "../components/UserAvatar";
import HorizontalScroller from "../components/HorizontalScroller";
import { mediaUrl } from "../utils/media";
import AuthorStripItem from "../components/AuthorStripItem";
import SortBar, { buildFeedQueryUrl } from "../components/SortBar";
import ConfirmDialog from "../components/ConfirmDialog";
import "./Explore.css";

export default function Explore() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const followRequestsRef = useRef(new Set());

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
  const [followPending, setFollowPending] = useState({});

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

  // Fetch All Posts with AbortSignal to cancel stale requests
  const fetchPosts = useCallback(
    async (targetPage = 1, append = false, signal = null) => {
      if (append) {
        setPostsLoadingMore(true);
      } else {
        setPostsLoading(true);
        setPostsError("");
      }

      try {
        const url = buildFeedQueryUrl("/posts", {
          page: targetPage,
          limit: 10,
          sort,
          hasVideo,
          authorId: selectedAuthor?._id || null,
        });

        const res = await apiFetch(url, { signal });
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
        if (err.name === "AbortError") return;
        setPostsError(err.message || "Unable to load posts");
      } finally {
        setPostsLoading(false);
        setPostsLoadingMore(false);
      }
    },
    [sort, hasVideo, selectedAuthor]
  );

  // Initial loads for authors & trending
  useEffect(() => {
    fetchAuthors();
    fetchTrending();
  }, [fetchAuthors, fetchTrending]);

  // Feed fetch on sort/filter change with AbortController
  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(1, false, controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchPosts]);

  // Handle Sort Change (resets to page 1 & scrolls smoothly)
  const handleSortChange = (newSort) => {
    setSort(newSort);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle Has Video Toggle (resets to page 1 & scrolls smoothly)
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

  // Load More Posts (Pagination)
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
    if (!authorId || followRequestsRef.current.has(authorId)) return;

    const previousFollowing = Boolean(author.isFollowing);
    const previousFollowers = author.followersCount ?? 0;
    const optimisticFollowers = previousFollowers + 1;
    followRequestsRef.current.add(authorId);
    setFollowPending((prev) => ({ ...prev, [authorId]: true }));

    setAuthors((prev) =>
      prev.map((item) =>
        (item._id || item.id) === authorId
          ? { ...item, isFollowing: true, followersCount: optimisticFollowers }
          : item
      )
    );
    patchFollowState(queryClient, authorId, true, optimisticFollowers);

    try {
      const res = await apiFetch(`/users/${encodeURIComponent(authorId)}/follow`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        throw new Error(data.message || `Follow request failed (${res.status})`);
      }

      patchFollowState(queryClient, authorId, true, data.data?.followers);
      setAuthors((prev) =>
        prev.map((item) =>
          (item._id || item.id) === authorId
            ? { ...item, followersCount: data.data?.followers ?? item.followersCount }
            : item
        )
      );
      toast.success(`You are now following @${author.username}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.suggestions() }),
        queryClient.invalidateQueries({ queryKey: ["connections"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarPosts() }),
      ]);
    } catch (error) {
      setAuthors((prev) =>
        prev.map((item) =>
          (item._id || item.id) === authorId
            ? { ...item, isFollowing: previousFollowing, followersCount: previousFollowers }
            : item
        )
      );
      patchFollowState(queryClient, authorId, previousFollowing, previousFollowers);
      toast.error(error.message || "Failed to follow author");
    } finally {
      followRequestsRef.current.delete(authorId);
      setFollowPending((prev) => ({ ...prev, [authorId]: false }));
    }
  };

  // Unfollow confirmation action (optimistic)
  const handleConfirmUnfollow = async () => {
    if (!unfollowTarget || unfollowLoading) return;
    setUnfollowLoading(true);

    const target = unfollowTarget;
    const authorId = target._id || target.id;
    const authorUsername = target.username;
    const previousAuthor = authors.find((item) => (item._id || item.id) === authorId) || target;
    const previousFollowing = Boolean(previousAuthor.isFollowing);
    const previousFollowers = previousAuthor.followersCount ?? 0;
    const optimisticFollowers = Math.max(0, previousFollowers - 1);

    setAuthors((prev) =>
      prev.map((item) =>
        (item._id || item.id) === authorId
          ? { ...item, isFollowing: false, followersCount: optimisticFollowers }
          : item
      )
    );
    patchFollowState(queryClient, authorId, false, optimisticFollowers);

    try {
      const res = await apiFetch(`/users/${encodeURIComponent(authorId)}/follow`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        throw new Error(data.message || `Unfollow request failed (${res.status})`);
      }

      patchFollowState(queryClient, authorId, false, data.data?.followers);
      setAuthors((prev) =>
        prev.map((item) =>
          (item._id || item.id) === authorId
            ? { ...item, followersCount: data.data?.followers ?? item.followersCount }
            : item
        )
      );
      toast.success(`Unfollowed @${authorUsername}`);
      setUnfollowTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.suggestions() }),
        queryClient.invalidateQueries({ queryKey: ["connections"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarPosts() }),
      ]);
    } catch (error) {
      setAuthors((prev) =>
        prev.map((item) =>
          (item._id || item.id) === authorId
            ? { ...item, isFollowing: previousFollowing, followersCount: previousFollowers }
            : item
        )
      );
      patchFollowState(queryClient, authorId, previousFollowing, previousFollowers);
      toast.error(error.message || "Failed to unfollow author");
    } finally {
      setUnfollowLoading(false);
    }
  };

  // Resolve cover image for trending cards
  const getCoverImageUrl = (coverImage) => {
    return mediaUrl(coverImage, { w: 640, h: 360, fit: "fill" });
  };

  return (
    <main className="explore-container">
      {/* =========================================
          1. POPULAR AUTHORS ROW (Floating, unboxed)
      ========================================= */}
      <section className="explore-authors-section" aria-label="Popular authors">
        <div className="explore-section-header">
          <div className="explore-section-title-wrap">
            <Users size={14} color="#e8590c" />
            <h2 className="explore-section-heading">POPULAR AUTHORS</h2>
          </div>
        </div>

        {/* Loading Skeletons */}
        {authorsLoading && (
          <div style={{ display: "flex", gap: 14, overflowX: "hidden" }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
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

        {/* Authors Scroller (Floating, unboxed style matching Following strip) */}
        {!authorsLoading && !authorsError && authors.length > 0 && (
          <HorizontalScroller gap={14} scrollStep={240} ariaLabel="Popular authors row">
            {authors.map((author) => {
              const isSelected = selectedAuthor?._id === author._id;

              return (
                <AuthorStripItem
                  key={author._id}
                  author={author}
                  isSelected={isSelected}
                  showStats={true}
                  showFollowButton={true}
                  followLoading={Boolean(followPending[author._id || author.id]) || (unfollowLoading && (unfollowTarget?._id || unfollowTarget?.id) === (author._id || author.id))}
                  onFollowToggle={(target) => {
                    if (target.isFollowing) {
                      setUnfollowTarget(target);
                    } else {
                      handleFollowAuthor(target);
                    }
                  }}
                  onClick={() => {
                    if (author.username) {
                      navigate(`/profile/${author.username}`);
                    } else {
                      setSelectedAuthor(author);
                    }
                  }}
                />
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
            <Flame size={14} color="#e8590c" />
            <h2 className="explore-section-heading">{trendingLabel.toUpperCase()}</h2>
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
              const isVideoPost = Boolean(post.videoUrl || post.type === "video");

              return (
                <Link
                  key={post._id}
                  to={`/post/${post._id}`}
                  className="explore-trending-card"
                  onClick={(e) => {
                    const selection = window.getSelection()?.toString();
                    if (selection && selection.trim().length > 0) {
                      e.preventDefault();
                    }
                  }}
                  aria-label={`View trending post: ${post.title}`}
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

                    {isVideoPost && (
                      <div className="explore-trending-video-indicator" aria-hidden="true">
                        <span className="explore-trending-play-icon">
                          <Play size={16} fill="#ffffff" color="#ffffff" />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="explore-trending-content">
                    <h3 className="explore-trending-title">{post.title}</h3>

                    <div className="explore-trending-meta">
                      <span
                        className="explore-trending-author"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (post.author?.username) {
                            navigate(`/profile/${post.author.username}`);
                          }
                        }}
                      >
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
                </Link>
              );
            })}
          </HorizontalScroller>
        )}
      </section>

      {/* =========================================
          3. ALL POSTS SECTION
      ========================================= */}
      <section className="explore-posts-section" aria-label="All published posts">
        {/* Shared Sticky Sort and Filter Bar */}
        <SortBar
          sort={sort}
          onSortChange={handleSortChange}
          hasVideo={hasVideo}
          onHasVideoToggle={handleHasVideoToggle}
          selectedAuthor={selectedAuthor}
          onClearAuthor={handleClearAuthor}
        />

        {/* Loading Skeletons during initial or refetch */}
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

        {/* Posts Error State */}
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

        {/* Dedicated Empty State: Has Video toggle returns 0 posts */}
        {!postsLoading && !postsError && posts.length === 0 && hasVideo && (
          <div className="following-empty-card">
            <div className="following-empty-icon" style={{ background: "#ffedd5", color: "#e8590c" }}>
              <Video size={28} />
            </div>
            <h2 className="following-empty-title">No video posts yet</h2>
            <p className="following-empty-desc">
              There are currently no published stories with videos matching your criteria.
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

        {/* General Empty State */}
        {!postsLoading && !postsError && posts.length === 0 && !hasVideo && (
          <div className="following-empty-card">
            <div className="following-empty-icon">
              <Compass size={28} />
            </div>
            <h2 className="following-empty-title">No stories found</h2>
            <p className="following-empty-desc">
              {selectedAuthor
                ? "No stories match your current author filter. Try resetting the filter."
                : "No published stories yet. Be the first to publish a story on Kathā!"}
            </p>
            {selectedAuthor ? (
              <button
                type="button"
                className="following-pill-btn"
                onClick={handleClearAuthor}
              >
                Reset filter
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
