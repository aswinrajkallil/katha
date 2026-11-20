import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  X,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Trash2,
  Filter,
  FileText,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Archive,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./AdminPosts.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export default function AdminPosts() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "published" | "draft"
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [postToDelete, setPostToDelete] = useState(null);
  const [postToPurge, setPostToPurge] = useState(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch paginated posts
  const queryKey = queryKeys.adminPosts({
    page,
    status: statusFilter,
    search: debouncedSearch,
    deleted: showDeleted,
  });

  const {
    data: postsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (showDeleted) params.set("deleted", "true");
      return apiQuery(`/admin/posts?${params.toString()}`);
    },
    staleTime: 30 * 1000,
  });

  const posts = postsData?.posts || [];
  const pagination = postsData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  // Optimistic deletion mutation
  const deleteMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/admin/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete post");
      }
      return data;
    },
    onMutate: async (postId) => {
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous posts
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update query data
      if (previousData?.posts) {
        queryClient.setQueryData(queryKey, {
          ...previousData,
          posts: previousData.posts.filter((p) => p._id !== postId),
          pagination: {
            ...previousData.pagination,
            total: Math.max(0, (previousData.pagination?.total || 1) - 1),
          },
        });
      }

      return { previousData };
    },
    onError: (err, postId, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(err.message || "Could not delete post");
    },
    onSuccess: () => {
      toast.success("Post moved to Deleted Posts");
    },
    onSettled: () => {
      // Invalidate relevant queries to keep counts and feeds in sync
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    },
  });

  // Restore a soft-deleted post
  const restoreMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/admin/posts/${postId}/restore`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to restore post");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Post restored");
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    },
    onError: (err) => toast.error(err.message || "Could not restore post"),
  });

  // Permanently delete a post that is already in the Deleted Posts view
  const purgeMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/admin/posts/${postId}/permanent`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete post");
      return data;
    },
    onSuccess: () => {
      toast.success("Post permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    },
    onError: (err) => toast.error(err.message || "Could not delete post"),
  });

  const handleDeleteConfirm = () => {
    if (!postToDelete) return;
    const id = postToDelete._id;
    setPostToDelete(null);
    deleteMutation.mutate(id);
  };

  const handlePurgeConfirm = () => {
    if (!postToPurge) return;
    const id = postToPurge._id;
    setPostToPurge(null);
    purgeMutation.mutate(id);
  };

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Posts Moderation</h1>
          <p className="admin-page-subtitle">
            {showDeleted
              ? "Posts removed from the platform. Restore them or delete them for good."
              : "Search, inspect, and remove posts across the platform"}
          </p>
        </div>
      </div>

      {/* View toggle: Active vs Deleted */}
      <div className="admin-posts-status-filters" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`admin-filter-pill ${!showDeleted ? "active" : ""}`}
          onClick={() => {
            setShowDeleted(false);
            setPage(1);
          }}
        >
          <FileText size={14} /> Active Posts
        </button>
        <button
          type="button"
          className={`admin-filter-pill ${showDeleted ? "active" : ""}`}
          onClick={() => {
            setShowDeleted(true);
            setStatusFilter("");
            setPage(1);
          }}
        >
          <Archive size={14} /> Deleted Posts
        </button>
      </div>

      {/* Toolbar: Search + Status Filter */}
      <div className="admin-posts-toolbar">
        <div className="admin-search-box">
          <Search size={18} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search by title, excerpt, or tags..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {!showDeleted && (
          <div className="admin-posts-status-filters">
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
            >
              All Statuses
            </button>
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "published" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("published");
                setPage(1);
              }}
            >
              Published
            </button>
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "draft" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("draft");
                setPage(1);
              }}
            >
              Drafts
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {isError && (
        <div className="admin-error-box">
          <AlertCircle size={28} color="#dc2626" />
          <div className="admin-error-content">
            <h3>Unable to load posts</h3>
            <p>{error?.message || "An unexpected error occurred while fetching posts."}</p>
          </div>
          <button type="button" className="admin-btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Table Card */}
      {!isError && (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={8}>
                        <div className="skeleton-line" style={{ height: 26 }} />
                      </td>
                    </tr>
                  ))
                ) : posts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      <FileText size={32} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                      <p>
                        {showDeleted
                          ? "No deleted posts."
                          : "No posts found matching the filter."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post._id}>
                      <td className="admin-post-title-cell">
                        <span className="admin-post-title-text" title={post.title}>
                          {post.title}
                        </span>
                        {post.category?.name && (
                          <span className="admin-post-category-tag">{post.category.name}</span>
                        )}
                      </td>
                      <td>
                        {post.author ? (
                          <Link
                            to={`/admin/users/${post.author._id}`}
                            className="admin-post-author-link"
                          >
                            <UserAvatar user={post.author} size={24} />
                            <div className="admin-post-author-info">
                              <span className="admin-post-author-name">
                                {post.author.fullName || post.author.username}
                              </span>
                              <span className="admin-post-author-handle">
                                @{post.author.username}
                              </span>
                            </div>
                          </Link>
                        ) : (
                          <span className="admin-deleted-author">[deleted author]</span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status-badge ${post.status}`}>
                          {post.status}
                        </span>
                      </td>
                      <td>
                        <span className="admin-metric-inline">
                          <Eye size={14} color="#64748b" />
                          <span>{post.views ?? 0}</span>
                        </span>
                      </td>
                      <td>
                        <span className="admin-metric-inline">
                          <Heart size={14} color="#dc2626" />
                          <span>{post.likesCount ?? 0}</span>
                        </span>
                      </td>
                      <td>
                        <span className="admin-metric-inline">
                          <MessageCircle size={14} color="#e8590c" />
                          <span>{post.commentsCount ?? 0}</span>
                        </span>
                      </td>
                      <td className="admin-table-date">{formatDate(post.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-table-row-actions">
                          <Link
                            to={`/post/${post._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-post-action-btn view"
                            title="View post on site"
                          >
                            <ExternalLink size={15} />
                            <span>View</span>
                          </Link>
                          {showDeleted ? (
                            <>
                              <button
                                type="button"
                                className="admin-post-action-btn"
                                onClick={() => restoreMutation.mutate(post._id)}
                                disabled={restoreMutation.isPending}
                                title="Restore post"
                              >
                                <RotateCcw size={15} />
                                <span>Restore</span>
                              </button>
                              <button
                                type="button"
                                className="admin-post-action-btn delete"
                                onClick={() => setPostToPurge(post)}
                                title="Delete permanently"
                              >
                                <Trash2 size={15} />
                                <span>Delete Forever</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-post-action-btn delete"
                              onClick={() => setPostToDelete(post)}
                              title="Delete post"
                            >
                              <Trash2 size={15} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="admin-pagination-bar">
              <span className="admin-pagination-info">
                Showing {(page - 1) * 10 + 1}–
                {Math.min(page * 10, pagination.total)} of {pagination.total} posts
              </span>
              <div className="admin-pagination-actions">
                <button
                  type="button"
                  className="admin-pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="admin-pagination-current">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="admin-pagination-btn"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Post Confirm Dialog (soft delete) */}
      <ConfirmDialog
        isOpen={Boolean(postToDelete)}
        title="Delete this post?"
        message={`"${postToDelete?.title}" will be hidden from the site and moved to Deleted Posts. You can restore it later.`}
        confirmText="Delete Post"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onClose={() => setPostToDelete(null)}
      />

      {/* Permanent Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(postToPurge)}
        title="Delete this post forever?"
        message={`"${postToPurge?.title}" and all of its comments, likes, and images will be permanently removed. This cannot be undone.`}
        confirmText="Delete Forever"
        loading={purgeMutation.isPending}
        onConfirm={handlePurgeConfirm}
        onClose={() => setPostToPurge(null)}
      />
    </div>
  );
}
