import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, SearchX, PlusCircle, Heart, MessageCircle, Video as VideoIcon } from "lucide-react";
import PostCard from "./PostCard";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { mediaUrl } from "../../utils/media";
import "./PostList.css";

const PostSkeleton = () => (
  <div className="post-skeleton-card" aria-hidden="true">
    <div className="skeleton-header">
      <div className="skeleton-avatar skeleton-shimmer" />
      <div className="skeleton-meta skeleton-shimmer" />
    </div>
    <div className="skeleton-title skeleton-shimmer" />
    <div className="skeleton-text skeleton-shimmer" />
    <div className="skeleton-media skeleton-shimmer" />
    <div className="skeleton-actions">
      <div className="skeleton-pill skeleton-shimmer" />
      <div className="skeleton-pill skeleton-shimmer" />
      <div className="skeleton-pill skeleton-shimmer" />
    </div>
  </div>
);

const PostList = ({ authorId, showDrafts = false, myPosts = false, bookmarks = false, viewMode = "list" }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [page, setPage] = useState(1);

    const canFilter = !myPosts && !authorId && !bookmarks;

    // Read from URL search parameters
    const qParam = canFilter ? (searchParams.get("q") || "").trim() : "";
    const timeParam = canFilter ? (searchParams.get("time") || "") : "";
    const sortParam = canFilter ? (searchParams.get("sort") || "latest") : "latest";

    // Reset pagination to page 1 whenever query or filters change
    useEffect(() => {
        setPage(1);
    }, [qParam, timeParam, sortParam]);

    const filterObj = useMemo(() => ({
        page,
        limit: 10,
        ...(myPosts && { myPosts: true }),
        ...(authorId && { authorId }),
        ...(bookmarks && { bookmarks: true }),
        ...(canFilter && {
            ...(qParam && { search: qParam }),
            ...(timeParam && { dateRange: timeParam }),
            sort: sortParam,
        }),
    }), [page, myPosts, authorId, bookmarks, canFilter, qParam, timeParam, sortParam]);

    const queryKey = bookmarks
        ? queryKeys.bookmarks()
        : authorId
        ? queryKeys.posts({ authorId, page })
        : myPosts
        ? queryKeys.posts({ myPosts: true, page })
        : queryKeys.posts(filterObj);

    const {
        data: queryData,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey,
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ page: String(page), limit: "10" });
            if (canFilter) {
                if (qParam) params.set("search", qParam);
                if (timeParam) params.set("dateRange", timeParam);
                params.set("sort", sortParam);
            }

            const path = bookmarks
                ? "/bookmarks"
                : myPosts
                ? "/posts/my"
                : authorId
                ? `/users/${encodeURIComponent(authorId)}/posts`
                : "/posts";

            return apiQuery(`${path}?${params.toString()}`, { signal });
        },
    });

    const posts = useMemo(() => {
        if (!queryData) return [];
        if (bookmarks) {
            const raw = queryData.bookmarks || [];
            return raw
                .map((b) => (b.post ? { ...b.post, bookmarkId: b._id } : null))
                .filter(Boolean);
        }
        return queryData.posts || [];
    }, [queryData, bookmarks]);

    const pagination = queryData?.pagination || null;
    const error = queryError ? queryError.message : "";

    const handleClearSearch = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete("q");
            next.delete("time");
            next.delete("sort");
            return next;
        }, { replace: true });
    };

    const hasActiveFilters = Boolean(qParam || timeParam || (sortParam && sortParam !== "latest"));

    return (
        <div className="post-list-container">
            {/* Result line when search/filters are active */}
            {canFilter && hasActiveFilters && !loading && (
                <div className="post-search-status-bar">
                    <span className="post-search-status-text">
                        {pagination?.total ?? posts.length}{" "}
                        {pagination?.total === 1 || posts.length === 1 ? "result" : "results"}
                        {qParam ? ` for "${qParam}"` : ""}
                    </span>
                    <button
                        type="button"
                        onClick={handleClearSearch}
                        className="post-search-clear-btn"
                        aria-label="Clear search and filters"
                    >
                        Clear
                    </button>
                </div>
            )}

            {error && <p role="alert" className="post-list-error">{error}</p>}

            {/* Skeleton Loaders while loading */}
            {loading && (
                <div className="post-skeletons-group">
                    <PostSkeleton />
                    <PostSkeleton />
                    <PostSkeleton />
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && posts.length === 0 && (
                <div className="post-list-empty">
                    <div className="post-empty-icon-wrap">
                        {hasActiveFilters ? <SearchX size={32} /> : <Sparkles size={32} />}
                    </div>
                    <h3 className="post-empty-title">
                        {myPosts
                            ? "You haven't created any posts yet"
                            : hasActiveFilters
                            ? "No matching posts found"
                            : "No stories published yet"}
                    </h3>
                    <p className="post-list-empty-subtitle">
                        {myPosts
                            ? "Share your stories, videos, and thoughts with the Kathā community."
                            : hasActiveFilters
                            ? "Try adjusting your search terms or resetting the active filters."
                            : "Be the first to share a story or video with Kathā."}
                    </p>
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="post-list-empty-clear-btn"
                        >
                            Reset filters
                        </button>
                    ) : (
                        <Link to="/posts/create" className="btn-primary" style={{ marginTop: 8 }}>
                            <PlusCircle size={16} /> Write a Story
                        </Link>
                    )}
                </div>
            )}

            {/* Posts Feed or Grid */}
            {!loading && (
                viewMode === "grid" ? (
                    <div className="post-grid-container">
                        {posts.map(post => (
                            <Link
                                key={post._id}
                                to={`/post/${post._id}`}
                                className="post-grid-item"
                                aria-label={post.title}
                            >
                                {post.coverImage ? (
                                    <img
                                        src={mediaUrl(post.coverImage, { w: 400, h: 400, fit: "fill" })}
                                        alt={post.title}
                                        className="post-grid-image"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="post-grid-fallback">
                                        <span className="post-grid-fallback-title">{post.title}</span>
                                    </div>
                                )}
                                {post.type === "video" && (
                                    <span className="post-grid-video-badge" aria-label="Video">
                                        <VideoIcon size={14} />
                                    </span>
                                )}
                                <div className="post-grid-overlay">
                                    <span className="post-grid-stat">
                                        <Heart size={16} fill="white" />
                                        {post.likesCount || 0}
                                    </span>
                                    <span className="post-grid-stat">
                                        <MessageCircle size={16} fill="white" />
                                        {post.commentsCount || 0}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    posts.map(post => (
                        <PostCard
                            key={post._id}
                            post={post}
                            onDelete={deletedId => setPosts(current => current.filter(item => item._id !== deletedId))}
                        />
                    ))
                )
            )}

            {/* Pagination */}
            {!loading && pagination && pagination.totalPages > 1 && (
                <div className="post-list-pagination">
                    <button
                        disabled={page <= 1 || loading}
                        onClick={() => setPage(current => current - 1)}
                    >
                        ← Previous
                    </button>
                    <span>
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                        disabled={page >= pagination.totalPages || loading}
                        onClick={() => setPage(current => current + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default PostList;
