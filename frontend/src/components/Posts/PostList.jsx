import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Sparkles, SearchX, PlusCircle } from "lucide-react";
import PostCard from "./PostCard";
import apiFetch from "../../api/api";
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

const PostList = ({ authorId, showDrafts = false, myPosts = false }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    const canFilter = !myPosts && !authorId;

    // Read from URL search parameters
    const qParam = canFilter ? (searchParams.get("q") || "").trim() : "";
    const timeParam = canFilter ? (searchParams.get("time") || "") : "";
    const sortParam = canFilter ? (searchParams.get("sort") || "latest") : "latest";

    // Reset pagination to page 1 whenever query or filters change
    useEffect(() => {
        setPage(1);
    }, [qParam, timeParam, sortParam]);

    useEffect(() => {
        let isCurrent = true;

        const loadPosts = async () => {
            setLoading(true);
            setError("");
            try {
                const params = new URLSearchParams({ page: String(page), limit: "10" });
                if (canFilter) {
                    if (qParam) params.set("search", qParam);
                    if (timeParam) params.set("dateRange", timeParam);
                    params.set("sort", sortParam);
                }

                const path = myPosts
                    ? "/posts/my"
                    : authorId
                    ? `/users/${encodeURIComponent(authorId)}/posts`
                    : "/posts";

                const response = await apiFetch(`${path}?${params.toString()}`);
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to load posts");
                }
                if (isCurrent) {
                    setPosts(data.data.posts || []);
                    setPagination(data.data.pagination || null);
                }
            } catch (err) {
                if (isCurrent) {
                    setError(
                        err.message === "SESSION_EXPIRED"
                            ? "Your session has expired. Please sign in again."
                            : (err.message || "Failed to load posts")
                    );
                }
            } finally {
                if (isCurrent) {
                    setLoading(false);
                }
            }
        };

        loadPosts();

        return () => {
            isCurrent = false;
        };
    }, [myPosts, authorId, page, canFilter, qParam, timeParam, sortParam]);

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

            {/* Posts Feed */}
            {!loading && posts.map(post => (
                <PostCard
                    key={post._id}
                    post={post}
                    onDelete={deletedId => setPosts(current => current.filter(item => item._id !== deletedId))}
                />
            ))}

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
