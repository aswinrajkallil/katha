import { useEffect, useState } from "react";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";

export default function FollowingFeed() {
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        setLoading(true); setError("");
        apiFetch(`/feed/following?page=${page}&limit=10`).then(async res => {
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Unable to load feed");
            if (active) { setPosts(data.data.posts || []); setPagination(data.data.pagination); }
        }).catch(err => { if (active) setError(err.message); })
          .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [page]);
    return <main style={{ maxWidth: 820, margin: "32px auto", padding: 20 }}>
        <h1>Following feed</h1><p style={{ color: "#666" }}>Latest published stories from people you follow.</p>
        {loading && <p>Loading your feed...</p>}
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        {!loading && !error && posts.length === 0 && <p>Your feed is empty. Follow authors to see their stories here.</p>}
        {posts.map(post => <PostCard key={post._id} post={post} />)}
        {pagination?.totalPages > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages || loading} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>}
    </main>;
}
