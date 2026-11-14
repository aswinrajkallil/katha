import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";
import CommentForm from "./CommentForm";

const CommentItem = ({ comment, postId, onCommentAdded, onCommentDeleted }) => {
    const { user } = useAuth();
    const [showReplyForm, setShowReplyForm] = useState(false);

    const isAuthor = user && comment.author && user._id === comment.author._id;
    const isAdmin = user && user.role === "admin";
    const canDelete = isAuthor || isAdmin;

    const handleDelete = async () => {
        if (!window.confirm("Delete this comment?")) return;
        try {
            const res = await apiFetch(`/comments/${comment._id}`, { method: "DELETE" });
            if (res.ok) onCommentDeleted && onCommentDeleted(comment._id);
        } catch (_) {}
    };

    const handleReplyAdded = (reply) => {
        onCommentAdded && onCommentAdded(reply);
        setShowReplyForm(false);
    };

    return (
        <div style={{ borderLeft: "3px solid #eee", paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <strong>
                    <Link to={`/profile/${comment.author?._id}`} style={{ color: "#000" }}>
                        {comment.author?.username || "Unknown"}
                    </Link>
                </strong>
                <span style={{ color: "#aaa", fontSize: 12 }}>
                    {new Date(comment.createdAt).toLocaleDateString()}
                </span>
            </div>
            <p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>{comment.content}</p>
            <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                {user && (
                    <button
                        onClick={() => setShowReplyForm((v) => !v)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}
                    >
                        Reply
                    </button>
                )}
                {canDelete && (
                    <button
                        onClick={handleDelete}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}
                    >
                        Delete
                    </button>
                )}
            </div>
            {showReplyForm && (
                <div style={{ marginTop: 8 }}>
                    <CommentForm
                        postId={postId}
                        parentCommentId={comment._id}
                        onCommentAdded={handleReplyAdded}
                        onCancel={() => setShowReplyForm(false)}
                    />
                </div>
            )}
            {comment.replies?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply._id}
                            comment={reply}
                            postId={postId}
                            onCommentAdded={onCommentAdded}
                            onCommentDeleted={onCommentDeleted}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CommentList = ({ comments, postId, onCommentAdded, onCommentDeleted }) => {
    if (!comments.length) {
        return <p style={{ color: "#888" }}>No comments yet. Be the first to comment!</p>;
    }

    return (
        <div style={{ marginTop: 16 }}>
            {comments.map((comment) => (
                <CommentItem
                    key={comment._id}
                    comment={comment}
                    postId={postId}
                    onCommentAdded={onCommentAdded}
                    onCommentDeleted={onCommentDeleted}
                />
            ))}
        </div>
    );
};

export default CommentList;
