import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";
import CommentList from "../Comments/CommentList";
import CommentForm from "../Comments/CommentForm";

const PostDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [likes, setLikes] = useState(0);
    const [userLiked, setUserLiked] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);
    const [comments, setComments] = useState([]);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const res = await apiFetch(`/posts/${id}`);
                const data = await res.json();
                if (data.success) {
                    setPost(data.data);
                } else {
                    setError(data.message || "Post not found");
                }
            } catch (e) {
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        const fetchLikes = async () => {
            try {
                const res = await apiFetch(`/posts/${id}/likes`);
                const data = await res.json();
                if (data.success) {
                    setLikes(data.data.likes);
                    setUserLiked(data.data.userLiked);
                }
            } catch (_) {}
        };

        const fetchComments = async () => {
            try {
                const res = await apiFetch(`/posts/${id}/comments`);
                const data = await res.json();
                if (data.success) setComments(data.data);
            } catch (_) {}
        };

        fetchPost();
        fetchLikes();
        fetchComments();
    }, [id]);

    const handleLike = async () => {
        if (!user) { navigate("/login"); return; }
        setLikeLoading(true);
        try {
            const method = userLiked ? "DELETE" : "POST";
            const res = await apiFetch(`/posts/${id}/like`, { method });
            const data = await res.json();
            if (data.success) {
                setLikes(data.data.likes);
                setUserLiked(!userLiked);
            }
        } catch (_) {}
        setLikeLoading(false);
    };

    const handleBookmark = async () => {
        if (!user) { navigate("/login"); return; }
        try {
            const method = bookmarked ? "DELETE" : "POST";
            const res = await apiFetch(`/posts/${id}/bookmark`, { method });
            const data = await res.json();
            if (data.success) setBookmarked(!bookmarked);
        } catch (_) {}
    };

    const handleDelete = async () => {
        if (!window.confirm("Delete this post?")) return;
        try {
            const res = await apiFetch(`/posts/${id}`, { method: "DELETE" });
            if (res.ok) navigate("/my-posts");
        } catch (_) {}
    };

    const handleCommentAdded = (newComment) => {
        setComments((prev) => [newComment, ...prev]);
    };

    const handleCommentDeleted = (commentId) => {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
    };

    if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
    if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;
    if (!post) return <p style={{ padding: 24 }}>Post not found</p>;

    const isAuthor = user && post.author && user._id === post.author._id;
    const isAdmin = user && user.role === "admin";
    const canModify = isAuthor || isAdmin;

    return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
            <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                    background: post.type === "video" ? "#e63946" : "#2a9d8f",
                    color: "#fff",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12
                }}>
                    {post.type === "video" ? "📹 Video" : "✍️ Blog"}
                </span>
                {post.status === "draft" && (
                    <span style={{ background: "#f4a261", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>
                        Draft
                    </span>
                )}
            </div>

            <h1 style={{ marginBottom: 8 }}>{post.title}</h1>

            <div style={{ color: "#888", fontSize: 14, marginBottom: 16, display: "flex", gap: 16 }}>
                <span>By <Link to={`/profile/${post.author?._id}`}>{post.author?.username}</Link></span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <span>👁 {post.views}</span>
            </div>

            {post.coverImage && (
                <img
                    src={`${import.meta.env.VITE_API_URL}${post.coverImage}`}
                    alt={post.title}
                    style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8, marginBottom: 24 }}
                />
            )}

            {post.type === "video" && post.videoUrl && (
                <div style={{ marginBottom: 24 }}>
                    <a href={post.videoUrl} target="_blank" rel="noopener noreferrer">
                        🎬 Watch Video: {post.videoUrl}
                    </a>
                </div>
            )}

            {post.content && (
                <div style={{ lineHeight: 1.8, marginBottom: 24, whiteSpace: "pre-wrap" }}>
                    {post.content}
                </div>
            )}

            {post.tags?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    {post.tags.map((tag) => (
                        <span key={tag} style={{
                            background: "#f0f0f0",
                            borderRadius: 4,
                            padding: "2px 10px",
                            marginRight: 6,
                            fontSize: 13
                        }}>
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
                <button
                    onClick={handleLike}
                    disabled={likeLoading}
                    style={{ padding: "8px 16px", cursor: "pointer", background: userLiked ? "#e63946" : "#eee", color: userLiked ? "#fff" : "#000", border: "none", borderRadius: 4 }}
                >
                    {userLiked ? "❤️" : "🤍"} {likes} {likes === 1 ? "Like" : "Likes"}
                </button>
                <button
                    onClick={handleBookmark}
                    style={{ padding: "8px 16px", cursor: "pointer", background: bookmarked ? "#2a9d8f" : "#eee", color: bookmarked ? "#fff" : "#000", border: "none", borderRadius: 4 }}
                >
                    {bookmarked ? "🔖 Bookmarked" : "📌 Bookmark"}
                </button>
                {canModify && (
                    <>
                        <Link to={`/posts/${id}/edit`}><button style={{ padding: "8px 16px" }}>Edit</button></Link>
                        <button onClick={handleDelete} style={{ padding: "8px 16px", color: "red", cursor: "pointer" }}>Delete</button>
                    </>
                )}
            </div>

            <hr style={{ marginBottom: 32 }} />

            <h3>Comments ({comments.length})</h3>

            {user ? (
                <CommentForm postId={id} onCommentAdded={handleCommentAdded} />
            ) : (
                <p><Link to="/login">Log in</Link> to comment.</p>
            )}

            <CommentList
                comments={comments}
                postId={id}
                onCommentAdded={handleCommentAdded}
                onCommentDeleted={handleCommentDeleted}
            />
        </div>
    );
};

export default PostDetails;
