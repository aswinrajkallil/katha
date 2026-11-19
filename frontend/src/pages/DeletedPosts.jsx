import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import apiFetch, { apiQuery } from "../api/api";
import { useToast } from "../context/ToastContext";
import { mediaUrl } from "../utils/media";
import BackButton from "../components/BackButton";
import ConfirmDialog from "../components/ConfirmDialog";
import "./DeletedPosts.css";

const formatDeletedAt = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const request = async (path, method, fallbackMessage) => {
  const res = await apiFetch(path, { method });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
};

export default function DeletedPosts() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [purgeTarget, setPurgeTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deleted-posts", page],
    queryFn: () => apiQuery(`/posts/deleted?page=${page}&limit=10`),
    refetchOnMount: "always",
  });

  const posts = data?.posts || [];
  const pagination = data?.pagination;

  // Anything that lists posts could now include (restore) or exclude (purge) this one
  const refreshEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ["deleted-posts"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar"] });
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const restore = useMutation({
    mutationFn: (post) => request(`/posts/${post._id}/restore`, "PATCH", "Couldn't restore this post"),
    onSuccess: (_data, post) => {
      toast.success(`Restored "${post.title}"`);
      refreshEverywhere();
      // Landing on an emptied last page: step back one page
      if (posts.length === 1 && page > 1) setPage((p) => p - 1);
    },
    onError: (err) => toast.error(err.message || "Couldn't restore this post"),
  });

  const purge = useMutation({
    mutationFn: (post) => request(`/posts/${post._id}/permanent`, "DELETE", "Couldn't delete this post"),
    onSuccess: () => {
      toast.success("Post permanently deleted");
      setPurgeTarget(null);
      refreshEverywhere();
      if (posts.length === 1 && page > 1) setPage((p) => p - 1);
    },
    onError: (err) => {
      setPurgeTarget(null);
      toast.error(err.message || "Couldn't delete this post");
    },
  });

  const busyId = restore.isPending ? restore.variables?._id : null;

  return (
    <main className="deleted-posts-page">
      <BackButton />

      <header className="deleted-posts-header">
        <h1 className="deleted-posts-title">Deleted posts</h1>
        <p className="deleted-posts-subtitle">
          Posts you delete are kept here. Restore one to publish it again, or delete it forever.
        </p>
      </header>

      {isLoading && (
        <div className="deleted-posts-skeletons" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="deleted-post-skeleton skeleton-shimmer" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="deleted-posts-empty" role="alert">
          <p>{error.message || "Couldn't load your deleted posts."}</p>
          <button type="button" className="deleted-btn deleted-btn-restore" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && posts.length === 0 && (
        <div className="deleted-posts-empty">
          <div className="deleted-posts-empty-icon">
            <Trash2 size={28} />
          </div>
          <h2>No deleted posts</h2>
          <p>When you delete a post it will show up here, and you can restore it.</p>
          <Link to="/my-posts" className="deleted-btn deleted-btn-restore">
            Go to My Posts
          </Link>
        </div>
      )}

      {!isLoading && posts.length > 0 && (
        <ul className="deleted-posts-list">
          {posts.map((post) => {
            const thumb = post.coverImage || post.videoThumbnail;
            return (
              <li key={post._id} className="deleted-post-card">
                <div className="deleted-post-thumb">
                  {thumb ? (
                    <img src={mediaUrl(thumb, { w: 200, h: 200, fit: "fill" })} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">
                      <FileText size={22} />
                    </span>
                  )}
                </div>

                <div className="deleted-post-body">
                  <h2 className="deleted-post-title">{post.title}</h2>
                  {post.excerpt && <p className="deleted-post-excerpt">{post.excerpt}</p>}
                  <p className="deleted-post-meta">
                    Deleted {formatDeletedAt(post.deletedAt)}
                    {post.status === "draft" && <span className="deleted-post-badge">Draft</span>}
                  </p>
                </div>

                <div className="deleted-post-actions">
                  <button
                    type="button"
                    className="deleted-btn deleted-btn-restore"
                    onClick={() => restore.mutate(post)}
                    disabled={busyId === post._id}
                  >
                    <RotateCcw size={15} />
                    <span>{busyId === post._id ? "Restoring..." : "Restore"}</span>
                  </button>
                  <button
                    type="button"
                    className="deleted-btn deleted-btn-danger"
                    onClick={() => setPurgeTarget(post)}
                    disabled={busyId === post._id}
                  >
                    <Trash2 size={15} />
                    <span>Delete forever</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="deleted-posts-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(purgeTarget)}
        title="Delete forever?"
        message={
          purgeTarget
            ? `"${purgeTarget.title}" and all of its comments and likes will be permanently removed. This can't be undone.`
            : ""
        }
        confirmText="Delete forever"
        cancelText="Keep it"
        loading={purge.isPending}
        onConfirm={() => purgeTarget && purge.mutate(purgeTarget)}
        onClose={() => setPurgeTarget(null)}
      />
    </main>
  );
}
