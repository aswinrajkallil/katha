import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";

const Bookmarks = () => {
    const { user } = useAuth();
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;
        const fetchBookmarks = async () => {
            try {
                const res = await apiFetch("/bookmarks");
                const data = await res.json();
                if (data.success) {
                    setBookmarks(data.data.bookmarks);
                } else {
                    setError(data.message || "Failed to load bookmarks");
                }
            } catch (e) {
                setError("Failed to load bookmarks");
            } finally {
                setLoading(false);
            }
        };
        fetchBookmarks();
    }, [user]);

    if (!user) {
        return (
            <div style={{ padding: 40, textAlign: "center" }}>
                <p>Please <Link to="/login">log in</Link> to view your bookmarks.</p>
            </div>
        );
    }

    if (loading) return <p style={{ padding: 24 }}>Loading bookmarks...</p>;
    if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;

    return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
            <h1>My Bookmarks</h1>
            {bookmarks.length === 0 ? (
                <p style={{ color: "#888" }}>No bookmarks yet. Explore posts and save them here.</p>
            ) : (
                bookmarks.map((bookmark) =>
                    bookmark.post ? (
                        <PostCard
                            key={bookmark._id}
                            post={bookmark.post}
                            onDelete={(id) =>
                                setBookmarks((prev) => prev.filter((b) => b.post?._id !== id))
                            }
                        />
                    ) : null
                )
            )}
        </div>
    );
};

export default Bookmarks;
