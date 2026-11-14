import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";

const PostCard = ({ post, onDelete }) => {
    const { user } = useAuth();

    const isAuthor = user && post.author && user._id === post.author._id;
    const isAdmin = user && user.role === "admin";
    const canModify = isAuthor || isAdmin;

    const handleDelete = async () => {
        if (!window.confirm("Delete this post? This cannot be undone.")) return;
        try {
            const res = await apiFetch(`/posts/${post._id}`, { method: "DELETE" });
            if (res.ok) {
                onDelete && onDelete(post._id);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to delete post");
            }
        } catch (e) {
            alert("Something went wrong");
        }
    };

    return (
        <div style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            background: "#fff"
        }}>
            {post.coverImage && (
                <img
                    src={`${import.meta.env.VITE_API_URL}${post.coverImage}`}
                    alt={post.title}
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 4, marginBottom: 8 }}
                />
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
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
                {post.category && (
                    <span style={{ color: "#666", fontSize: 12 }}>
                        {post.category.name}
                    </span>
                )}
            </div>

            <h3 style={{ margin: "0 0 8px" }}>
                <Link to={`/posts/${post._id}`} style={{ textDecoration: "none", color: "#000" }}>
                    {post.title}
                </Link>
            </h3>

            {post.excerpt && (
                <p style={{ color: "#555", margin: "0 0 8px", fontSize: 14 }}>{post.excerpt}</p>
            )}

            <div style={{ fontSize: 13, color: "#888", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>By {post.author?.username ? <Link to={`/profile/${post.author.username}`}>@{post.author.username}</Link> : "Unknown"}</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <span>👁 {post.views}</span>
                {post.tags?.length > 0 && (
                    <span>🏷 {post.tags.join(", ")}</span>
                )}
            </div>

            {canModify && (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <Link to={`/posts/${post._id}/edit`}>
                        <button>Edit</button>
                    </Link>
                    <button onClick={handleDelete} style={{ color: "red" }}>Delete</button>
                </div>
            )}
        </div>
    );
};

export default PostCard;
