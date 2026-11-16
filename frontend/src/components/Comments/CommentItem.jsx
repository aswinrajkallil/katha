import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  CornerDownRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import UserAvatar from "../UserAvatar";
import CommentForm from "./CommentForm";
import ConfirmDialog from "../ConfirmDialog";
import "./Comments.css";

const getRelativeTime = (dateStr) => {
  if (!dateStr) return "just now";
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  const diffYr = Math.floor(diffDay / 365);
  return `${diffYr}y ago`;
};

// Count all descendants for a comment
const countDescendants = (node) => {
  if (!node || !node.children || node.children.length === 0) return 0;
  return node.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
};

function CommentItem({
  comment,
  postId,
  postAuthorId,
  depth = 0,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || "");
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Like state (optimistic)
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [likedByMe, setLikedByMe] = useState(Boolean(comment.likedByMe));
  const [likeBusy, setLikeBusy] = useState(false);

  // Replies visibility (pagination: show 4 initially if many)
  const initialRepliesLimit = 4;
  const totalReplies = comment.children ? comment.children.length : 0;
  const [showAllReplies, setShowAllReplies] = useState(totalReplies <= initialRepliesLimit);

  // Deep nesting flatten state (beyond 6 levels)
  const [unfoldedDeep, setUnfoldedDeep] = useState(false);

  const moreMenuRef = useRef(null);

  // Sync state if comment prop updates
  useEffect(() => {
    setLikesCount(comment.likesCount || 0);
    setLikedByMe(Boolean(comment.likedByMe));
    setEditContent(comment.content || "");
  }, [comment.likesCount, comment.likedByMe, comment.content]);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  // Ownership & OP check
  const authorId = comment.author?._id || comment.author?.id;
  const currentUserId = user?._id || user?.id;
  const isOwner = Boolean(user && authorId && currentUserId && authorId.toString() === currentUserId.toString());
  const isAdmin = Boolean(user && user.role === "admin");
  const canManage = (isOwner || isAdmin) && !comment.isDeleted;
  const isPostAuthor = Boolean(
    postAuthorId && authorId && postAuthorId.toString() === authorId.toString()
  );

  const fullDate = comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "";
  const totalDescendantCount = countDescendants(comment);

  // Handle Like Toggle
  const handleLikeToggle = async () => {
    if (!user) {
      toast.error("Please log in to like comments");
      return;
    }
    if (comment.isDeleted || likeBusy) return;

    // Optimistic toggle
    const prevLiked = likedByMe;
    const prevCount = likesCount;
    const newLiked = !prevLiked;
    const newCount = newLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    setLikedByMe(newLiked);
    setLikesCount(newCount);
    setLikeBusy(true);

    try {
      const res = await apiFetch(`/comments/${comment._id}/like`, {
        method: newLiked ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        setLikedByMe(prevLiked);
        setLikesCount(prevCount);
        toast.error(data.message || "Failed to update like");
      } else if (data.data) {
        setLikedByMe(Boolean(data.data.liked));
        setLikesCount(data.data.likesCount);
      }
    } catch {
      // Rollback
      setLikedByMe(prevLiked);
      setLikesCount(prevCount);
      toast.error("Network error updating like");
    } finally {
      setLikeBusy(false);
    }
  };

  // Handle Share Link
  const handleShare = () => {
    const url = `${window.location.origin}/post/${postId}#comment-${comment._id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Comment link copied!"))
        .catch(() => toast.info(`Link: ${url}`));
    } else {
      toast.info(`Link: ${url}`);
    }
  };

  // Handle Edit Submit
  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.error("Comment cannot be empty");
      return;
    }
    if (trimmed.length > 2000) {
      toast.error("Comment cannot exceed 2000 characters");
      return;
    }

    setEditLoading(true);
    try {
      const res = await apiFetch(`/comments/${comment._id}`, {
        method: "PUT",
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEditing(false);
        toast.success("Comment updated");
        if (onCommentUpdated) {
          onCommentUpdated(data.data);
        }
      } else {
        toast.error(data.message || "Failed to update comment");
      }
    } catch {
      toast.error("Network error updating comment");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete Comment
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/comments/${comment._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmDelete(false);
        toast.success("Comment removed");
        if (onCommentDeleted) {
          onCommentDeleted(comment._id, Boolean(data.softDeleted));
        }
      } else {
        toast.error(data.message || "Failed to delete comment");
      }
    } catch {
      toast.error("Network error deleting comment");
    } finally {
      setDeleting(false);
    }
  };

  // If collapsed, display compact single line
  if (isCollapsed) {
    return (
      <div className="reddit-comment-collapsed-row" onClick={() => setIsCollapsed(false)}>
        <span className="reddit-comment-collapsed-badge">[+]</span>
        <strong>@{comment.author?.username || "[deleted]"}</strong>
        <span>•</span>
        <span>{getRelativeTime(comment.createdAt)}</span>
        <span>•</span>
        <span>
          {totalDescendantCount > 0
            ? `${totalDescendantCount} ${totalDescendantCount === 1 ? "reply" : "replies"} collapsed`
            : "collapsed"}
        </span>
      </div>
    );
  }

  // Visual indentation clamping for deep tree (depth >= 6)
  const isDeep = depth >= 6 && !unfoldedDeep;

  // Sliced children based on "View more replies" pagination
  const visibleChildren = showAllReplies
    ? comment.children || []
    : (comment.children || []).slice(0, initialRepliesLimit);

  return (
    <div
      id={`comment-${comment._id}`}
      className="reddit-comment-item-container reddit-fade-in"
    >
      <div className="reddit-comment-item-inner">
        {/* Left thread line column: avatar on top, vertical clickable line under */}
        <div
          className="reddit-threadline-col"
          onClick={() => setIsCollapsed(true)}
          title="Click to collapse thread"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsCollapsed(true);
            }
          }}
        >
          <div className="reddit-threadline-avatar-wrapper">
            <UserAvatar
              user={comment.isDeleted ? null : comment.author}
              size={24}
            />
          </div>
          <div className="reddit-threadline-bar" />
        </div>

        {/* Right comment content column */}
        <div className="reddit-comment-content-col">
          {/* Header Row */}
          <div className="reddit-comment-header-row">
            {comment.isDeleted ? (
              <span className="reddit-comment-author-name" style={{ color: "#9ca3af" }}>
                [deleted]
              </span>
            ) : (
              <Link
                to={`/profile/${comment.author?.username || comment.author?._id}`}
                className="reddit-comment-author-name"
              >
                @{comment.author?.username || "unknown"}
              </Link>
            )}

            {isPostAuthor && !comment.isDeleted && (
              <span className="reddit-comment-op-badge" title="Original Poster">
                Author
              </span>
            )}

            <span className="reddit-comment-dot">•</span>

            <span className="reddit-comment-time" title={fullDate}>
              {getRelativeTime(comment.createdAt)}
            </span>

            {comment.isEdited && !comment.isDeleted && (
              <span className="reddit-comment-edited-tag">(edited)</span>
            )}
          </div>

          {/* Comment Body / Edit View */}
          {isEditing ? (
            <div className="reddit-comment-edit-box">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="reddit-comment-edit-textarea"
                rows={3}
                disabled={editLoading}
                maxLength={2000}
                autoFocus
              />
              <div className="reddit-comment-edit-actions">
                <button
                  type="button"
                  className="reddit-comment-btn-cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content || "");
                  }}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="reddit-comment-btn-submit"
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editContent.trim()}
                >
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className={`reddit-comment-text ${comment.isDeleted ? "deleted" : ""}`}>
              {comment.content}
            </div>
          )}

          {/* Action Row */}
          {!comment.isDeleted && (
            <div className="reddit-comment-actions">
              {/* Like Button */}
              <button
                type="button"
                className={`reddit-action-btn ${likedByMe ? "liked" : ""}`}
                onClick={handleLikeToggle}
                disabled={likeBusy}
                aria-label={`${likesCount} likes`}
              >
                <Heart
                  size={15}
                  fill={likedByMe ? "#dc2626" : "none"}
                  color={likedByMe ? "#dc2626" : "currentColor"}
                />
                <span>{likesCount}</span>
              </button>

              {/* Reply Button */}
              <button
                type="button"
                className={`reddit-action-btn ${showReplyForm ? "active" : ""}`}
                onClick={() => setShowReplyForm((v) => !v)}
              >
                <MessageCircle size={15} />
                <span>Reply</span>
              </button>

              {/* Share Button */}
              <button
                type="button"
                className="reddit-action-btn"
                onClick={handleShare}
                title="Copy link to comment"
              >
                <Share2 size={15} />
                <span>Share</span>
              </button>

              {/* More Menu (Edit/Delete) */}
              {canManage && (
                <div className="reddit-comment-more-wrap" ref={moreMenuRef}>
                  <button
                    type="button"
                    className="reddit-action-btn"
                    onClick={() => setShowMoreMenu((v) => !v)}
                    aria-label="More comment options"
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  {showMoreMenu && (
                    <div className="reddit-comment-dropdown">
                      <button
                        type="button"
                        className="reddit-dropdown-item"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setIsEditing(true);
                        }}
                      >
                        <Pencil size={14} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        className="reddit-dropdown-item danger"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setConfirmDelete(true);
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Inline Reply Form */}
          {showReplyForm && (
            <CommentForm
              postId={postId}
              parentCommentId={comment._id}
              initialExpanded={true}
              autoFocus={true}
              onCommentAdded={(newReply) => {
                setShowReplyForm(false);
                if (onCommentAdded) {
                  onCommentAdded(newReply);
                }
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          )}

          {/* Nested Replies */}
          {comment.children && comment.children.length > 0 && (
            <>
              {isDeep ? (
                <button
                  type="button"
                  className="reddit-continue-thread-btn"
                  onClick={() => setUnfoldedDeep(true)}
                >
                  <CornerDownRight size={14} />
                  <span>Continue this thread ({comment.children.length} replies) →</span>
                </button>
              ) : (
                <div className={`reddit-replies-list ${depth >= 5 ? "reddit-replies-clamped" : ""}`}>
                  {visibleChildren.map((child) => (
                    <CommentItem
                      key={child._id}
                      comment={child}
                      postId={postId}
                      postAuthorId={postAuthorId}
                      depth={depth + 1}
                      onCommentAdded={onCommentAdded}
                      onCommentUpdated={onCommentUpdated}
                      onCommentDeleted={onCommentDeleted}
                    />
                  ))}

                  {/* View More Replies button */}
                  {!showAllReplies && totalReplies > initialRepliesLimit && (
                    <button
                      type="button"
                      className="reddit-view-more-replies-btn"
                      onClick={() => setShowAllReplies(true)}
                    >
                      <span>
                        View {totalReplies - initialRepliesLimit} more{" "}
                        {totalReplies - initialRepliesLimit === 1 ? "reply" : "replies"}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this comment?"
        message="If this comment has replies, its content will be replaced with [deleted] to keep conversation context. Otherwise it will be removed permanently."
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default React.memo(CommentItem);
