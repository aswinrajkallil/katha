import { useState } from "react";
import apiFetch from "../../api/api";

const CommentForm = ({ postId, parentCommentId = null, onCommentAdded, onCancel }) => {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;
        setLoading(true);
        setError("");

        try {
            const body = { content };
            if (parentCommentId) body.parentComment = parentCommentId;

            const res = await apiFetch(`/posts/${postId}/comments`, {
                method: "POST",
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.success) {
                setContent("");
                onCommentAdded && onCommentAdded(data.data);
            } else {
                setError(data.message || "Failed to post comment");
            }
        } catch (e) {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={parentCommentId ? "Write a reply..." : "Write a comment..."}
                rows={3}
                style={{ width: "100%", padding: 8, fontFamily: "inherit", marginBottom: 8 }}
            />
            {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={loading || !content.trim()} style={{ padding: "6px 16px" }}>
                    {loading ? "Posting..." : parentCommentId ? "Reply" : "Comment"}
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel} style={{ padding: "6px 16px" }}>
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};

export default CommentForm;
