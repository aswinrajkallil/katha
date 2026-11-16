import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Bookmark,
  Share2,
  Eye,
  Pencil,
  Trash2,
  Video as VideoIcon,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSocket, usePostRoom } from "../../context/SocketContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys, patchPostEverywhere } from "../../api/queryClient";
import CommentList from "../Comments/CommentList";
import CommentForm from "../Comments/CommentForm";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import UserAvatar from "../UserAvatar";
import { mediaUrl } from "../../utils/media";
import "./PostDetails.css";

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

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

export default function PostDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [commentsSort, setCommentsSort] = useState("best");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Prefix key: matches the comments cache for every sort order of this post
  const commentsPrefix = ["comments", String(id || "")];

  // 1. Single query for Post + likesCount + commentsCount + likedByMe + bookmarkedByMe
  const {
    data: post,
    isLoading: loading,
    error: postError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => apiQuery(`/posts/${id}`),
    staleTime: 60 * 1000,
  });

  // 2. Query for Comments
  const {
    data: comments = [],
    isLoading: commentsLoading,
  } = useQuery({
    queryKey: queryKeys.comments(id, commentsSort),
    queryFn: () => apiQuery(`/posts/${id}/comments?sort=${commentsSort}`),
    staleTime: 60 * 1000,
  });

  const { socket } = useSocket();
  usePostRoom(id);

  // Realtime updates for post room
  useEffect(() => {
    if (!socket || !id) return;

    const isMe = (actorId) => actorId && (actorId === user?._id || actorId === user?.id);
    const prefix = ["comments", String(id)];

    const onPostLike = (data) => {
      if (data.postId === id && !isMe(data.actorId)) {
        patchPostEverywhere(queryClient, id, (old) => ({ ...old, likesCount: data.likesCount }));
      }
    };

    const onCommentCreated = (data) => {
      if (data.postId === id && !isMe(data.actorId)) {
        patchPostEverywhere(queryClient, id, (old) => ({ ...old, commentsCount: data.commentsCount }));
        queryClient.invalidateQueries({ queryKey: prefix });
      }
    };

    const onCommentUpdated = (data) => {
      if (data.postId === id && !isMe(data.actorId)) {
        queryClient.invalidateQueries({ queryKey: prefix });
      }
    };

    const onCommentDeleted = (data) => {
      if (data.postId === id && !isMe(data.actorId)) {
        patchPostEverywhere(queryClient, id, (old) => ({ ...old, commentsCount: data.commentsCount }));
        queryClient.invalidateQueries({ queryKey: prefix });
      }
    };

    socket.on("post:like", onPostLike);
    socket.on("comment:created", onCommentCreated);
    socket.on("comment:updated", onCommentUpdated);
    socket.on("comment:deleted", onCommentDeleted);

    return () => {
      socket.off("post:like", onPostLike);
      socket.off("comment:created", onCommentCreated);
      socket.off("comment:updated", onCommentUpdated);
      socket.off("comment:deleted", onCommentDeleted);
    };
  }, [socket, id, user, queryClient]);

  const likes = post?.likesCount ?? 0;
  const userLiked = Boolean(post?.likedByMe);
  const bookmarked = Boolean(post?.bookmarkedByMe);
  const error = postError ? postError.message : "";

  // Optimistic Like Handler
  const handleLike = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (likeLoading) return;

    const prevLiked = userLiked;
    const prevCount = likes;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setLikeLoading(true);
    patchPostEverywhere(queryClient, id, (p) => ({
      ...p,
      likedByMe: nextLiked,
      likesCount: nextCount,
    }));

    try {
      const method = prevLiked ? "DELETE" : "POST";
      const res = await apiFetch(`/posts/${id}/like`, { method });
      if (!res.ok) throw new Error("Like failed");
    } catch {
      // Rollback
      patchPostEverywhere(queryClient, id, (p) => ({
        ...p,
        likedByMe: prevLiked,
        likesCount: prevCount,
      }));
      toast.error("Failed to update like");
    } finally {
      setLikeLoading(false);
    }
  };

  // Optimistic Bookmark Handler
  const handleBookmark = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const prevBookmarked = bookmarked;
    const nextBookmarked = !prevBookmarked;

    patchPostEverywhere(queryClient, id, (p) => ({
      ...p,
      bookmarkedByMe: nextBookmarked,
    }));

    try {
      const method = nextBookmarked ? "POST" : "DELETE";
      const res = await apiFetch(`/posts/${id}/bookmark`, { method });
      if (!res.ok) throw new Error("Bookmark failed");
      toast.success(nextBookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks");
    } catch {
      // Rollback
      patchPostEverywhere(queryClient, id, (p) => ({
        ...p,
        bookmarkedByMe: prevBookmarked,
      }));
      toast.error("Failed to update bookmark");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
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

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Post deleted successfully");
      queryClient.removeQueries({ queryKey: queryKeys.post(id) });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      navigate("/");
    } catch {
      toast.error("Something went wrong while deleting");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleCommentAdded = () => {
    queryClient.invalidateQueries({ queryKey: commentsPrefix });
    patchPostEverywhere(queryClient, id, (p) => ({
      ...p,
      commentsCount: (p.commentsCount || 0) + 1,
    }));
  };

  const handleCommentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: commentsPrefix });
  };

  const handleCommentDeleted = () => {
    queryClient.invalidateQueries({ queryKey: commentsPrefix });
    patchPostEverywhere(queryClient, id, (p) => ({
      ...p,
      commentsCount: Math.max(0, (p.commentsCount || 1) - 1),
    }));
  };

  const handleSortChange = (newSort) => {
    setCommentsSort(newSort);
  };

  if (loading) {
    return (
      <div className="post-details-page">
        <BackButton />
        <div className="post-details-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="confirm-btn-spinner" style={{ margin: "0 auto 16px auto", width: 24, height: 24, borderColor: "rgba(232, 89, 12, 0.2)", borderTopColor: "#e8590c" }} />
          <p style={{ color: "#70757a", margin: 0 }}>Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    const notFound = postError?.status === 404;
    return (
      <div className="post-details-page">
        <BackButton />
        <div className="post-details-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h2 style={{ color: "#dc2626", margin: "0 0 8px 0" }}>
            {notFound ? "Post Not Found" : "Couldn't load this post"}
          </h2>
          <p style={{ color: "#5f6368", marginBottom: 20 }}>
            {notFound
              ? "This story may have been deleted or is no longer available."
              : "Check your connection (the server may be waking up) and try again."}
          </p>
          {!notFound && (
            <button type="button" className="btn-primary" onClick={() => refetch()} style={{ marginRight: 8 }}>
              Try again
            </button>
          )}
          <Link to="/" className="btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const isAuthor = user && post.author && (user._id === post.author._id || user.id === post.author._id);
  const isAdmin = user && user.role === "admin";
  const canModify = isAuthor || isAdmin;
  const authorUsername = post.author?.username || "anonymous";

  const imageUrl = post.coverImage ? mediaUrl(post.coverImage, { w: 1400 }) : null;

  const youtubeEmbedUrl = post.videoUrl ? getYouTubeEmbedUrl(post.videoUrl) : null;

  return (
    <div className="post-details-page">
      <div className="post-details-top-bar">
        <BackButton />
        {canModify && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/posts/${id}/edit`} className="reddit-action-pill" style={{ textDecoration: "none" }}>
              <Pencil size={15} />
              <span>Edit</span>
            </Link>
            <button
              type="button"
              className="reddit-action-pill"
              style={{ color: "#dc2626" }}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Post Card */}
      <article className="post-details-card">
        {/* Header */}
        <div className="post-details-header">
          <Link
            to={post.author?.username ? `/profile/${post.author.username}` : "#"}
            className="post-details-author-chip"
          >
            <UserAvatar user={post.author} size={38} className="post-details-avatar" />
            <div className="post-details-author-info">
              <span className="post-details-author-name">@{authorUsername}</span>
              <span className="post-details-time">{getRelativeTime(post.createdAt)}</span>
            </div>
          </Link>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {post.category?.name && (
              <span className="reddit-category-badge">{post.category.name}</span>
            )}
            {post.status === "draft" && (
              <span className="reddit-draft-badge">Draft</span>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="post-details-title">{post.title}</h1>

        {/* Excerpt if present */}
        {post.excerpt && <p className="post-details-excerpt">{post.excerpt}</p>}

        {/* Media */}
        {imageUrl && (
          <div className="post-details-media-wrap">
            <div
              className="post-details-media-blur"
              style={{ backgroundImage: `url(${imageUrl})` }}
              aria-hidden="true"
            />
            <img src={imageUrl} alt={post.title} className="post-details-media-img" loading="lazy" decoding="async" />
          </div>
        )}

        {/* Video Embed or Link */}
        {post.videoUrl && (
          youtubeEmbedUrl ? (
            <div className="post-details-video-embed">
              <iframe
                src={youtubeEmbedUrl}
                title={post.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="post-details-video-iframe"
              />
            </div>
          ) : (
            <a
              href={post.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="post-details-video-link-card"
            >
              <VideoIcon size={20} color="#e8590c" />
              <span style={{ flex: 1 }}>Watch video: {post.videoUrl}</span>
              <ExternalLink size={16} color="#70757a" />
            </a>
          )
        )}

        {/* Main Content Body */}
        {post.content && (
          <div className="post-details-content">{post.content}</div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="post-details-tags">
            {post.tags.map((tag) => (
              <span key={tag} className="post-details-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="post-details-actions">
          <button
            type="button"
            className={`reddit-action-pill ${userLiked ? "liked" : ""}`}
            onClick={handleLike}
            disabled={likeLoading}
            aria-label={`${likes} likes`}
          >
            <Heart size={16} fill={userLiked ? "#dc2626" : "none"} color={userLiked ? "#dc2626" : "currentColor"} />
            <span>{likes} {likes === 1 ? "Like" : "Likes"}</span>
          </button>

          <button
            type="button"
            className={`reddit-action-pill ${bookmarked ? "bookmarked" : ""}`}
            onClick={handleBookmark}
            aria-label="Save post"
          >
            <Bookmark size={16} fill={bookmarked ? "#e8590c" : "none"} color={bookmarked ? "#e8590c" : "currentColor"} />
            <span>{bookmarked ? "Saved" : "Save"}</span>
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

          <div className="reddit-action-pill action-pill-static">
            <Eye size={16} />
            <span>{post.views || 0} views</span>
          </div>
        </div>

        {/* Thin divider before comments in continuous column */}
        <hr className="post-details-divider" />

        {/* Comment input pill/box */}
        <CommentForm postId={id} onCommentAdded={handleCommentAdded} />

        {/* Comment tree with header & sorting */}
        <CommentList
          comments={comments}
          postId={id}
          postAuthorId={post.author?._id || post.author?.id}
          loading={commentsLoading}
          sortBy={commentsSort}
          onSortChange={handleSortChange}
          onCommentAdded={handleCommentAdded}
          onCommentUpdated={handleCommentUpdated}
          onCommentDeleted={handleCommentDeleted}
        />
      </article>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this post?"
        message="This action cannot be undone. Your post and all comments will be removed."
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}