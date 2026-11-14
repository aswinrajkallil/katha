import { useState, useEffect } from "react";
import PostCard from "./PostCard";
import apiFetch from "../../api/api";

const PostList = ({ authorId, showDrafts = false, myPosts = false }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const fetchPosts = async () => {
        setLoading(true);
        setError("");

        try {
            let path;
            if (myPosts) {
                path = `/posts/my?page=${page}&limit=10`;
            } else if (authorId) {
                path = `/posts/user/${authorId}?page=${page}&limit=10`;
            } else {
                path = `/posts?page=${page}&limit=10`;
                if (search) path += `&search=${encodeURIComponent(search)}`;
                if (type) path += `&type=${type}`;
            }

            const res = await apiFetch(path);
            const data = await res.json();

            if (data.success) {
                setPosts(data.data.posts);
                setPagination(data.data.pagination);
            } else {
                setError(data.message || "Failed to load posts");
            }
        } catch (e) {
            setError("Failed to load posts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, [page, search, type, myPosts, authorId]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const handleDelete = (deletedId) => {
        setPosts((prev) => prev.filter((p) => p._id !== deletedId));
    };

    return (
        <div>
            {!myPosts && !authorId && (
                <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
                        <input
                            type="text"
                            placeholder="Search posts..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            style={{ padding: 8, minWidth: 200 }}
                        />
                        <button type="submit">Search</button>
                        {search && (
                            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
                                Clear
                            </button>
                        )}
                    </form>
                    <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} style={{ padding: 8 }}>
                        <option value="">All Types</option>
                        <option value="blog">Blog</option>
                        <option value="video">Video</option>
                    </select>
                </div>
            )}

            {loading && <p>Loading posts...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            {!loading && posts.length === 0 && (
                <p style={{ color: "#888" }}>
                    {myPosts ? "You haven't created any posts yet." : "No posts found."}
                </p>
            )}

            {posts.map((post) => (
                <PostCard key={post._id} post={post} onDelete={handleDelete} />
            ))}

            {pagination && pagination.totalPages > 1 && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        ← Previous
                    </button>
                    <span>Page {pagination.page} of {pagination.totalPages}</span>
                    <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default PostList;
