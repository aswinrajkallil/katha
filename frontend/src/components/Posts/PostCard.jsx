import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MessageCircle,
  Share2,
  Bookmark,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Video as VideoIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import ConfirmDialog from "../ConfirmDialog";
import UserAvatar from "../UserAvatar";
import "./PostCard.css";

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

export default function PostCard({ post, onDelete, isPreview = false, showFollowingBadge = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookmarked, setBookmarked] = useState(Boolean(post.isBookmarked));
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const menuRef = useRef(null);

  const isAuthor = user && post.author && (user._id === post.author._id || user.id === post.author._id);
  const isAdmin = user && user.role === "admin";
  const canModify = isAuthor || isAdmin;

  const isVideo = Boolean(post.videoUrl || post.type === "video");
  const authorUsername = post.author?.username || "anonymous";

  // Resolve cover image URL (handles local upload path, external URL, or blob/preview)
  let imageUrl = null;
  if (post.coverImage) {
    if (post.coverImage.startsWith("data:") || post.coverImage.startsWith("blob:") || post.coverImage.startsWith("http")) {
      imageUrl = post.coverImage;
    } else {
      imageUrl = `${import.meta.env.VITE_API_URL}${post.coverImage}`;
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const handleCardClick = () => {
    if (!isPreview && post._id) {
      navigate(`/post/${post._id}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleCardClick();
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (isPreview) return;
    const url = `${window.location.origin}/post/${post._id}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
      } else {
        toast.info(url);
      }
    } catch {
      toast.info(url);
    }
  };

  const handleBookmarkToggle = async (e) => {
    e.stopPropagation();
    if (isPreview) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (bookmarkLoading) return;

    setBookmarkLoading(true);
    try {
      const method = bookmarked ? "DELETE" : "POST";
      const res = await apiFetch(`/posts/${post._id}/bookmark`, { method });
      if (res.ok) {
        const next = !bookmarked;
        setBookmarked(next);
        toast.success(next ? "Post saved to Bookmarks" : "Removed from Bookmarks");
      }
    } catch {
      toast.error("Unable to update bookmark");
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/posts/${post._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Post deleted successfully");
        setConfirmOpen(false);
        if (onDelete) {
          onDelete(post._id);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete post");
      }
    } catch {
      toast.error("Something went wrong while deleting");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <article
        className="reddit-post-card"
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={isPreview ? -1 : 0}
        aria-label={`View post: ${post.title}`}
      >
        {/* Header Row */}
        <div className="reddit-post-header">
          <div className="reddit-post-meta">
            <Link
              to={post.author?.username ? `/profile/${post.author.username}` : "#"}
              onClick={(e) => e.stopPropagation()}
              className="reddit-author-chip"
              aria-label={`View profile of @${authorUsername}`}
            >
              <UserAvatar user={post.author} size={22} className="reddit-author-avatar" />
              <span className="reddit-author-name">@{authorUsername}</span>
              {showFollowingBadge && (
                <span className="reddit-following-pill">Following</span>
              )}
            </Link>

            <span className="reddit-meta-dot">•</span>
            <span className="reddit-post-time">{getRelativeTime(post.createdAt)}</span>

            {post.category?.name && (
              <>
                <span className="reddit-meta-dot">•</span>
                <span className="reddit-category-badge">{post.category.name}</span>
              </>
            )}

            {post.status === "draft" && (
              <span className="reddit-draft-badge">Draft</span>
            )}
          </div>

          {/* Three dots menu for author */}
          {canModify && !isPreview && (
            <div className="reddit-menu-container" ref={menuRef}>
              <button
                type="button"
                className="reddit-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="Post options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div
                  className="reddit-dropdown-menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="reddit-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/posts/${post._id}/edit`);
                    }}
                  >
                    <Pencil size={15} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="reddit-dropdown-item item-danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="reddit-post-title">{post.title}</h2>

        {/* Description Clamped to ~3 Lines */}
        {(post.content || post.excerpt) && (
          <p className="reddit-post-description">
            {post.excerpt || post.content}
          </p>
        )}

        {/* Media Container with Blurred Dimmed Letterbox Background */}
        {imageUrl && (
          <div className="reddit-media-container" onClick={(e) => e.stopPropagation()}>
            <div
              className="reddit-media-blur-bg"
              style={{ backgroundImage: `url(${imageUrl})` }}
              aria-hidden="true"
            />
            <img
              src={imageUrl}
              alt={post.title}
              className="reddit-media-foreground"
              loading="lazy"
            />
            {isVideo && (
              <div className="reddit-video-overlay">
                <span className="reddit-video-play-btn">
                  <Play size={22} fill="#ffffff" color="#ffffff" />
                </span>
                <span className="reddit-video-badge">
                  <VideoIcon size={12} /> Video
                </span>
              </div>
            )}
          </div>
        )}

        {/* If no image but has videoUrl, show a sleek video preview container */}
        {!imageUrl && isVideo && post.videoUrl && (
          <div className="reddit-media-container video-only-container" onClick={(e) => e.stopPropagation()}>
            <div className="reddit-video-placeholder">
              <span className="reddit-video-play-btn">
                <Play size={26} fill="#ffffff" color="#ffffff" />
              </span>
              <span className="reddit-video-url-hint">{post.videoUrl}</span>
            </div>
            <span className="reddit-video-badge">
              <VideoIcon size={12} /> Video
            </span>
          </div>
        )}

        {/* Action Bar Pills */}
        <div className="reddit-action-bar">
          <button
            type="button"
            className="reddit-action-pill"
            onClick={(e) => {
              e.stopPropagation();
              if (!isPreview && post._id) navigate(`/post/${post._id}`);
            }}
            aria-label={`${post.commentsCount || 0} comments`}
          >
            <MessageCircle size={16} />
            <span>{post.commentsCount || 0} Comments</span>
          </button>

          <button
            type="button"
            className="reddit-action-pill"
            onClick={handleShare}
            aria-label="Share post"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>

          <button
            type="button"
            className={`reddit-action-pill ${bookmarked ? "bookmarked" : ""}`}
            onClick={handleBookmarkToggle}
            aria-label="Save post"
          >
            <Bookmark size={16} fill={bookmarked ? "#e8590c" : "none"} color={bookmarked ? "#e8590c" : "currentColor"} />
            <span>{bookmarked ? "Saved" : "Save"}</span>
          </button>

          <div className="reddit-action-pill action-pill-static" aria-label={`${post.views || 0} views`}>
            <Eye size={16} />
            <span>{post.views || 0}</span>
          </div>
        </div>
      </article>

      {/* Themed Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete this post?"
        message="This can't be undone. Your story and all its discussions will be permanently removed."
        confirmText="Delete post"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
