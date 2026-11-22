import { useState, useRef, useEffect, memo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import apiFetch, { apiQuery } from "../../api/api";
import { patchPostEverywhere, seedPost, queryKeys } from "../../api/queryClient";
import ConfirmDialog from "../ConfirmDialog";
import UserAvatar from "../UserAvatar";
import { mediaUrl } from "../../utils/media";
import "./ActionPill.css";
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

const formatCount = (n) => {
  const num = Number(n) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
};

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

function PostCard({ post, onDelete, isPreview = false, showFollowingBadge = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookmarked, setBookmarked] = useState(Boolean(post.isBookmarked || post.bookmarkedByMe));
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    setBookmarked(Boolean(post.isBookmarked || post.bookmarkedByMe));
  }, [post.isBookmarked, post.bookmarkedByMe]);

  const isAuthor = user && post.author && (user._id === post.author._id || user.id === post.author._id);
  const isAdmin = user && (user.role === "admin" || user.role === "superadmin");
  const canModify = isAuthor || isAdmin;

  // Prefetch post and author on hover
  const handleMouseEnter = useCallback(() => {
    if (isPreview || !post._id) return;
    seedPost(queryClient, post);
    queryClient.prefetchQuery({
      queryKey: queryKeys.post(post._id),
      queryFn: () => apiQuery(`/posts/${post._id}`),
    });
    if (post.author?.username) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.profile(post.author.username),
        queryFn: () => apiQuery(`/users/${encodeURIComponent(post.author.username)}`),
      });
    }
  }, [isPreview, post, queryClient]);

  const isVideo = Boolean(post.videoUrl || post.type === "video");
  const authorUsername = post.author?.username || "anonymous";

  // Resolve cover image URL (handles local upload path, external URL, or blob/preview)
  const imageUrl = post.coverImage ? mediaUrl(post.coverImage, { w: 1000 }) : null;

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

  // Handle click on the stretched overlay link (supports middle click & text selection guard)
  const handleStretchedLinkClick = (e) => {
    if (isPreview || !post._id) {
      e.preventDefault();
      return;
    }
    // Don't navigate if user is currently selecting text on the card
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) {
      e.preventDefault();
      return;
    }
  };

  // Keyboard navigation on the card
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isPreview && post._id) {
      // If user pressed enter on an interactive button/link, don't double trigger
      if (e.target.tagName !== "BUTTON" && e.target.tagName !== "A") {
        navigate(`/post/${post._id}`);
      }
    }
  };

  // Play video button click handler
  const handlePlayVideo = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPreview || !post.videoUrl) return;

    const embedUrl = getYouTubeEmbedUrl(post.videoUrl);
    if (embedUrl) {
      setIsPlayingVideo(true);
    } else {
      // If provider is unsupported, open URL in new tab safely
      window.open(post.videoUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (isPreview || !post._id) return;
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
    if (isPreview || !post._id) return;
    if (!user) {
      navigate("/login");
      return;
    }

    const prev = Boolean(bookmarked);
    const next = !prev;

    // Optimistic cache update
    setBookmarked(next);
    patchPostEverywhere(queryClient, post._id, (p) => ({
      ...p,
      bookmarkedByMe: next,
    }));

    try {
      const method = next ? "POST" : "DELETE";
      const res = await apiFetch(`/posts/${post._id}/bookmark`, { method });
      if (!res.ok) throw new Error("Bookmark failed");
      toast.success(next ? "Post saved to Bookmarks" : "Removed from Bookmarks");
    } catch {
      // Rollback
      setBookmarked(prev);
      patchPostEverywhere(queryClient, post._id, (p) => ({
        ...p,
        bookmarkedByMe: prev,
      }));
      toast.error("Unable to update bookmark");
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/posts/${post._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Post moved to Deleted Posts");
        setConfirmOpen(false);
        queryClient.invalidateQueries({ queryKey: ["deleted-posts"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar"] });
        // Remove from queryClient
        queryClient.removeQueries({ queryKey: queryKeys.post(post._id) });
        queryClient.setQueriesData({ queryKey: ["posts"] }, (old) => {
          if (!old) return old;
          if (Array.isArray(old)) return old.filter((p) => p._id !== post._id);
          if (Array.isArray(old.posts)) {
            return { ...old, posts: old.posts.filter((p) => p._id !== post._id) };
          }
          return old;
        });
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

  const youtubeEmbedUrl = post.videoUrl ? getYouTubeEmbedUrl(post.videoUrl) : null;

  return (
    <>
      <article
        className="reddit-post-card"
        onMouseEnter={handleMouseEnter}
        onKeyDown={handleKeyDown}
        tabIndex={isPreview ? -1 : 0}
        aria-label={`View post: ${post.title}`}
      >
        {/* Stretched Link Overlay for Card Navigation (middle-click, Ctrl/Cmd-click, text-selection safe) */}
        {!isPreview && post._id && (
          <Link
            to={`/post/${post._id}`}
            className="reddit-post-stretched-link"
            aria-label={`Read full post: ${post.title}`}
            onClick={handleStretchedLinkClick}
            tabIndex={-1}
          />
        )}

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

        {/* Media Container: Image posts or Video posts */}
        {imageUrl && (
          <div className="reddit-media-container">
            {/* When user clicked play on video, render inline player with stopPropagation */}
            {isVideo && isPlayingVideo && youtubeEmbedUrl ? (
              <div
                className="reddit-inline-video-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={`${youtubeEmbedUrl}?autoplay=1`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="reddit-inline-video-iframe"
                />
              </div>
            ) : (
              <>
                {/* Blurred Dimmed Letterbox Background */}
                <div
                  className="reddit-media-blur-bg"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                  aria-hidden="true"
                />
                {/* Foreground Image */}
                <img
                  src={imageUrl}
                  alt={post.title}
                  className="reddit-media-foreground"
                  loading="lazy"
                  decoding="async"
                />
                {/* Video Overlay with exact hit-target Play Button */}
                {isVideo && (
                  <div className="reddit-video-overlay" aria-hidden="true">
                    <button
                      type="button"
                      className="reddit-video-play-btn"
                      aria-label="Play video"
                      onClick={handlePlayVideo}
                      tabIndex={0}
                    >
                      <Play size={28} fill="#ffffff" color="#ffffff" className="play-triangle-icon" />
                    </button>
                    <span className="reddit-video-badge">
                      <VideoIcon size={12} /> Video
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* If no image but has videoUrl, show a sleek video preview container */}
        {!imageUrl && isVideo && post.videoUrl && (
          <div className="reddit-media-container video-only-container">
            {isPlayingVideo && youtubeEmbedUrl ? (
              <div
                className="reddit-inline-video-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={`${youtubeEmbedUrl}?autoplay=1`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="reddit-inline-video-iframe"
                />
              </div>
            ) : (
              <div className="reddit-video-placeholder">
                <div className="reddit-video-overlay" aria-hidden="true">
                  <button
                    type="button"
                    className="reddit-video-play-btn"
                    aria-label="Play video"
                    onClick={handlePlayVideo}
                    tabIndex={0}
                  >
                    <Play size={28} fill="#ffffff" color="#ffffff" className="play-triangle-icon" />
                  </button>
                  <span className="reddit-video-badge">
                    <VideoIcon size={12} /> Video
                  </span>
                </div>
                <span className="reddit-video-url-hint">{post.videoUrl}</span>
              </div>
            )}
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
            <span>{formatCount(post.commentsCount)}</span>
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
            <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
            <span>{bookmarked ? "Saved" : "Save"}</span>
          </button>

          <div className="reddit-action-pill action-pill-static" aria-label={`${post.views || 0} views`}>
            <Eye size={16} />
            <span>{formatCount(post.views)}</span>
          </div>
        </div>
      </article>

      {/* Themed Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete this post?"
        message="It will be moved to Deleted Posts, where you can restore it later."
        confirmText="Delete post"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default memo(PostCard);
