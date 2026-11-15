import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PostCard from "./PostCard";
import apiFetch from "../../api/api";
import "./PostList.css";

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

            {loading && <p className="post-list-status">Loading posts...</p>}
            {error && <p role="alert" className="post-list-error">{error}</p>}

            {!loading && !error && posts.length === 0 && (
                <div className="post-list-empty">
                    <p className="post-list-empty-title">
                        {myPosts
                            ? "You haven't created any posts yet."
                            : hasActiveFilters
                            ? "No posts match your search or filters."
                            : "No stories have been published yet."}
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="post-list-empty-clear-btn"
                        >
                            Clear search & filters
                        </button>
                    )}
                </div>
            )}

            {posts.map(post => (
                <PostCard
                    key={post._id}
                    post={post}
                    onDelete={deletedId => setPosts(current => current.filter(item => item._id !== deletedId))}
                />
            ))}

            {pagination && pagination.totalPages > 1 && (
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
