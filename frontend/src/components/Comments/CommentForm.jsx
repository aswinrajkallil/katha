import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import UserAvatar from "../UserAvatar";
import "./Comments.css";

const CommentForm = forwardRef(function CommentForm({
  postId,
  parentCommentId = null,
  onCommentAdded,
  onCancel,
  placeholder = "Add a comment",
  autoFocus = false,
  initialExpanded = false,
  id: customId,
}, ref) {
  const { user } = useAuth();
  const toast = useToast();
  const [expanded, setExpanded] = useState(Boolean(initialExpanded || parentCommentId));
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setExpanded(true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    },
  }));

  // Auto-focus when requested or when expanded as an inline reply
  useEffect(() => {
    if ((autoFocus || parentCommentId) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, parentCommentId]);

  // Auto-grow textarea
  const handleInput = (e) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 260)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && !loading) {
        handleSubmit(e);
      }
    }
  };

  const handleCollapse = () => {
    if (!parentCommentId) {
      setExpanded(false);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    if (!user) {
      toast.error("Please log in to leave a comment");
      return;
    }

    if (trimmed.length > 2000) {
      toast.error("Comments cannot exceed 2000 characters");
      return;
    }

    setLoading(true);

    try {
      const body = { content: trimmed };
      if (parentCommentId) {
        body.parentComment = parentCommentId;
      }

      const res = await apiFetch(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setContent("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        if (!parentCommentId) {
          setExpanded(false);
        }
        toast.success(parentCommentId ? "Reply posted" : "Comment posted");
        if (onCommentAdded) {
          onCommentAdded(data.data);
        }
      } else {
        toast.error(data.message || "Failed to post comment");
      }
    } catch {
      toast.error("Network error. Unable to post comment.");
    } finally {
      setLoading(false);
    }
  };

  const formRootId = customId || (parentCommentId ? `comment-reply-form-${parentCommentId}` : "post-comment-form");

  // If user is not logged in and this is the main top-level form
  if (!user && !parentCommentId) {
    return (
      <div id={formRootId} className="reddit-comment-form-root">
        <div className="reddit-comment-form-collapsed" style={{ cursor: "default" }}>
          <UserAvatar user={null} size={28} />
          <div className="reddit-comment-placeholder-pill">
            <Link to="/login" style={{ color: "#e8590c", fontWeight: 600, textDecoration: "none" }}>Log in</Link>
            {" or "}
            <Link to="/register" style={{ color: "#e8590c", fontWeight: 600, textDecoration: "none" }}>Sign up</Link>
            {" to join the conversation."}
          </div>
        </div>
      </div>
    );
  }

  // Collapsed single-line Reddit pill
  if (!expanded && !parentCommentId) {
    return (
      <div id={formRootId} className="reddit-comment-form-root">
        <div
          className="reddit-comment-form-collapsed"
          onClick={() => setExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          <UserAvatar user={user} size={28} />
          <span className="reddit-comment-placeholder-pill">{placeholder}</span>
        </div>
      </div>
    );
  }

  // Expanded Form
  return (
    <div id={formRootId} className={`reddit-comment-form-root ${parentCommentId ? "reddit-inline-reply-box" : ""}`}>
      <div className="reddit-comment-form-card">
        <div className="reddit-comment-form-header">
          <UserAvatar user={user} size={26} />
          <span className="reddit-comment-author-label">
            {parentCommentId ? "Replying as" : "Commenting as"}{" "}
            <strong>@{user?.username || "you"}</strong>
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={parentCommentId ? "What are your thoughts?" : placeholder}
          className="reddit-comment-textarea"
          rows={parentCommentId ? 2 : 3}
          disabled={loading}
          maxLength={2000}
        />

        <div className="reddit-comment-form-footer">
          <span className="reddit-comment-hint">
            Ctrl+Enter to post • {2000 - content.length} chars left
          </span>

          <div className="reddit-comment-form-actions">
            {(expanded || parentCommentId) && (
              <button
                type="button"
                className="reddit-comment-btn-cancel"
                onClick={handleCollapse}
                disabled={loading}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              className="reddit-comment-btn-submit"
              onClick={handleSubmit}
              disabled={loading || !content.trim()}
            >
              {loading
                ? "Posting..."
                : parentCommentId
                ? "Reply"
                : "Comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CommentForm;
