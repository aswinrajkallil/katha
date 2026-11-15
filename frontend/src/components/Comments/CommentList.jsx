import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import CommentForm from "./CommentForm";
import ConfirmDialog from "../ConfirmDialog";

const CommentItem = ({ comment, postId, onCommentAdded, onCommentDeleted }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isAuthor = user && comment.author && (user._id === comment.author._id || user.id === comment.author._id);
    const isAdmin = user && user.role === "admin";
    const canDelete = isAuthor || isAdmin;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await apiFetch(`/comments/${comment._id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Comment deleted");
                setConfirmDelete(false);
                if (onCommentDeleted) {
                    onCommentDeleted(comment._id);
                }
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message || "Failed to delete comment");
            }
        } catch {
            toast.error("Failed to delete comment");
        } finally {
            setDeleting(false);
        }
    };

    const handleReplyAdded = (reply) => {
        if (onCommentAdded) {
            onCommentAdded(reply);
        }
        setShowReplyForm(false);
    };

    return (
        <div style={{ borderLeft: "3px solid #eee", paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <strong>
                    <Link to={`/profile/${comment.author?.username || comment.author?._id}`} style={{ color: "#202124", textDecoration: "none" }}>
                        @{comment.author?.username || "Unknown"}
                    </Link>
                </strong>
                <span style={{ color: "#888", fontSize: 12 }}>
                    {new Date(comment.createdAt).toLocaleDateString()}
                </span>
            </div>
            <p style={{ margin: "0 0 8px", lineHeight: 1.6, color: "#374151" }}>{comment.content}</p>
            <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                {user && !comment.parentComment && (
                    <button
                        onClick={() => setShowReplyForm((v) => !v)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#e8590c", fontWeight: 500 }}
                    >
                        Reply
                    </button>
                )}
                {canDelete && (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontWeight: 500 }}
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

            <ConfirmDialog
                isOpen={confirmDelete}
                title="Delete comment?"
                message="Are you sure you want to delete this comment? This cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                loading={deleting}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(false)}
            />
        </div>
    );
};

const CommentList = ({ comments, postId, onCommentAdded, onCommentDeleted }) => {
    if (!comments.length) {
        return <p style={{ color: "#888", fontStyle: "italic", margin: "16px 0" }}>No comments yet. Be the first to share your thoughts!</p>;
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
