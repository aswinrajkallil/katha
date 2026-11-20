import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Mail,
  MapPin,
  Globe,
  FileText,
  MessageCircle,
  Users,
  Eye,
  Heart,
  ExternalLink,
  Trash2,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./AdminUserDetail.css";

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

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [postsPage, setPostsPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [postToDelete, setPostToDelete] = useState(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [restoringPostId, setRestoringPostId] = useState(null);
  const [postToPurge, setPostToPurge] = useState(null);
  const [purgingPost, setPurgingPost] = useState(false);

  // User delete modal state
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [confirmUsernameInput, setConfirmUsernameInput] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [restoringUser, setRestoringUser] = useState(false);

  // Permanent delete modal state (only reachable once the account is already soft-deleted)
  const [showPurgeUserModal, setShowPurgeUserModal] = useState(false);
  const [confirmPurgeInput, setConfirmPurgeInput] = useState("");
  const [purgingUser, setPurgingUser] = useState(false);

  // 1. Fetch user detail & counts
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
    error: userErrObj,
    refetch: refetchUser,
  } = useQuery({
    queryKey: queryKeys.adminUser(id),
    queryFn: () => apiQuery(`/admin/users/${id}`),
    staleTime: 30 * 1000,
  });

  const targetUser = userData?.user;
  const counts = userData?.counts || { posts: 0, comments: 0, followers: 0, following: 0 };

  // 2. Fetch all user posts (including drafts)
  const {
    data: postsData,
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: queryKeys.adminUserPosts(id, { page: postsPage, status: statusFilter }),
    queryFn: () =>
      apiQuery(
        `/admin/users/${id}/posts?page=${postsPage}&status=${encodeURIComponent(statusFilter)}&limit=10`
      ),
    staleTime: 30 * 1000,
    enabled: Boolean(targetUser?._id),
  });

  const posts = postsData?.posts || [];
  const postsPagination = postsData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  // Single post deletion
  const handleDeletePost = async () => {
    if (!postToDelete) return;
    setDeletingPost(true);
    try {
      const res = await apiFetch(`/admin/posts/${postToDelete._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete post");

      toast.success("Post moved to Deleted Posts");
      setPostToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserPosts(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPosts() });
    } catch (err) {
      toast.error(err.message || "Could not delete post");
    } finally {
      setDeletingPost(false);
    }
  };

  // Restore a soft-deleted post belonging to this user
  const handleRestorePost = async (post) => {
    setRestoringPostId(post._id);
    try {
      const res = await apiFetch(`/admin/posts/${post._id}/restore`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to restore post");

      toast.success("Post restored");
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserPosts(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPosts() });
    } catch (err) {
      toast.error(err.message || "Could not restore post");
    } finally {
      setRestoringPostId(null);
    }
  };

  // Permanently delete a post that is already soft-deleted
  const handlePurgePost = async () => {
    if (!postToPurge) return;
    setPurgingPost(true);
    try {
      const res = await apiFetch(`/admin/posts/${postToPurge._id}/permanent`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete post");

      toast.success("Post permanently deleted");
      setPostToPurge(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserPosts(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPosts() });
    } catch (err) {
      toast.error(err.message || "Could not delete post");
    } finally {
      setPurgingPost(false);
    }
  };

  // Soft delete (deactivate) the user account, with typed username confirmation
  const handleDeleteUser = async () => {
    if (!targetUser || confirmUsernameInput !== targetUser.username) return;
    setDeletingUser(true);
    try {
      const res = await apiFetch(`/admin/users/${targetUser._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete user");

      toast.success(data.message || `User @${targetUser.username} deleted`);
      setShowDeleteUserModal(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    } catch (err) {
      toast.error(err.message || "Could not delete user");
    } finally {
      setDeletingUser(false);
    }
  };

  // Restore a soft-deleted account
  const handleRestoreUser = async () => {
    if (!targetUser) return;
    setRestoringUser(true);
    try {
      const res = await apiFetch(`/admin/users/${targetUser._id}/restore`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to restore user");

      toast.success(data.message || `User @${targetUser.username} restored`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserPosts(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    } catch (err) {
      toast.error(err.message || "Could not restore user");
    } finally {
      setRestoringUser(false);
    }
  };

  // Permanently delete an already soft-deleted account and all of its data
  const handlePurgeUser = async () => {
    if (!targetUser || confirmPurgeInput !== targetUser.username) return;
    setPurgingUser(true);
    try {
      const res = await apiFetch(`/admin/users/${targetUser._id}/permanent`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete user");

      toast.success(`User @${targetUser.username} permanently deleted`);
      setShowPurgeUserModal(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
      navigate("/admin/users", { replace: true });
    } catch (err) {
      toast.error(err.message || "Could not delete user");
    } finally {
      setPurgingUser(false);
    }
  };

  const isSelf = currentAdmin && targetUser && (currentAdmin._id === targetUser._id || currentAdmin.id === targetUser._id);
  const isTargetAdmin = targetUser?.role === "admin";
  const canDeleteUser = !isSelf && !isTargetAdmin;

  if (userLoading) {
    return (
      <div className="admin-page-container">
        <div className="skeleton-line" style={{ width: 120, height: 32, marginBottom: 24 }} />
        <div className="admin-user-detail-card skeleton-card" style={{ height: 200 }} />
      </div>
    );
  }

  if (userError || !targetUser) {
    return (
      <div className="admin-page-container">
        <Link to="/admin/users" className="admin-back-link">
          <ArrowLeft size={16} />
          <span>Back to Users</span>
        </Link>
        <div className="admin-error-box" style={{ marginTop: 20 }}>
          <AlertCircle size={32} color="#dc2626" />
          <h2>User Not Found</h2>
          <p>{userErrObj?.message || "Could not locate this user account."}</p>
          <button type="button" className="admin-btn-secondary" onClick={() => refetchUser()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      {/* Top Navigation */}
      <div className="admin-detail-topbar">
        <Link to="/admin/users" className="admin-back-link">
          <ArrowLeft size={16} />
          <span>Back to Users</span>
        </Link>
      </div>

      {/* Deleted account banner */}
      {targetUser.isDeleted && (
        <div className="admin-error-box" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <AlertTriangle size={28} color="#d97706" />
          <div className="admin-error-content">
            <h3>This account is deleted</h3>
            <p>
              @{targetUser.username} was deactivated
              {targetUser.deletedAt ? ` on ${formatDate(targetUser.deletedAt)}` : ""}. Their posts
              are hidden. Restore the account to bring it and its posts back.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={handleRestoreUser}
            disabled={restoringUser}
          >
            <RotateCcw size={14} /> {restoringUser ? "Restoring..." : "Restore Account"}
          </button>
        </div>
      )}

      {/* User Header Profile Card */}
      <section className="admin-user-header-card" aria-label="User profile overview">
        <div className="admin-user-header-top">
          <UserAvatar user={targetUser} size={72} className="admin-detail-avatar" />
          <div className="admin-user-header-meta">
            <div className="admin-user-header-name-row">
              <h1 className="admin-user-header-title">{targetUser.fullName || targetUser.username}</h1>
              <span className={`admin-role-pill ${targetUser.role === "admin" ? "admin" : "user"}`}>
                {targetUser.role === "admin" && <ShieldCheck size={12} />}
                {targetUser.role}
              </span>
            </div>
            <span className="admin-user-header-handle">@{targetUser.username}</span>

            <div className="admin-user-badges-row">
              <span className="admin-user-badge-item">
                <Mail size={14} />
                <span>{targetUser.email}</span>
              </span>
              <span className="admin-user-badge-item">
                <Calendar size={14} />
                <span>Joined {formatDate(targetUser.createdAt)}</span>
              </span>
              {targetUser.location && (
                <span className="admin-user-badge-item">
                  <MapPin size={14} />
                  <span>{targetUser.location}</span>
                </span>
              )}
              {targetUser.website && (
                <a
                  href={targetUser.website.startsWith("http") ? targetUser.website : `https://${targetUser.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-user-badge-item link"
                >
                  <Globe size={14} />
                  <span>{targetUser.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>

            {targetUser.bio && <p className="admin-user-bio">{targetUser.bio}</p>}
          </div>
        </div>

        {/* Counts Row */}
        <div className="admin-user-counts-strip">
          <div className="admin-count-item">
            <span className="admin-count-num">{counts.posts}</span>
            <span className="admin-count-label">Stories & Videos</span>
          </div>
          <div className="admin-count-item">
            <span className="admin-count-num">{counts.comments}</span>
            <span className="admin-count-label">Comments</span>
          </div>
          <div className="admin-count-item">
            <span className="admin-count-num">{counts.followers}</span>
            <span className="admin-count-label">Followers</span>
          </div>
          <div className="admin-count-item">
            <span className="admin-count-num">{counts.following}</span>
            <span className="admin-count-label">Following</span>
          </div>
        </div>
      </section>

      {/* User Posts Section */}
      <section className="admin-user-posts-section" aria-label="User posts moderation">
        <div className="admin-posts-header-row">
          <h2 className="admin-section-title">All Posts ({counts.posts})</h2>
          <div className="admin-status-filter-pills">
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("");
                setPostsPage(1);
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "published" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("published");
                setPostsPage(1);
              }}
            >
              Published
            </button>
            <button
              type="button"
              className={`admin-filter-pill ${statusFilter === "draft" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("draft");
                setPostsPage(1);
              }}
            >
              Drafts
            </button>
          </div>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {postsLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={7}>
                        <div className="skeleton-line" style={{ height: 26 }} />
                      </td>
                    </tr>
                  ))
                ) : posts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      No posts found for this user.
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
                        <span className={`admin-status-badge ${post.status}`}>
                          {post.isDeleted ? "deleted" : post.status}
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
                          {post.isDeleted ? (
                            <>
                              <button
                                type="button"
                                className="admin-post-action-btn"
                                onClick={() => handleRestorePost(post)}
                                disabled={restoringPostId === post._id}
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

          {/* Posts Pagination */}
          {postsPagination.totalPages > 1 && (
            <div className="admin-pagination-bar">
              <span className="admin-pagination-info">
                Showing {(postsPage - 1) * 10 + 1}–
                {Math.min(postsPage * 10, postsPagination.total)} of {postsPagination.total} posts
              </span>
              <div className="admin-pagination-actions">
                <button
                  type="button"
                  className="admin-pagination-btn"
                  disabled={postsPage <= 1}
                  onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="admin-pagination-current">
                  Page {postsPage} of {postsPagination.totalPages}
                </span>
                <button
                  type="button"
                  className="admin-pagination-btn"
                  disabled={postsPage >= postsPagination.totalPages}
                  onClick={() => setPostsPage((p) => Math.min(postsPagination.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone: User Account Deletion */}
      <section className="admin-danger-zone-card" aria-label="Danger zone user account deletion">
        <div className="admin-danger-zone-header">
          <div className="admin-danger-icon-wrap">
            <AlertTriangle size={24} color="#dc2626" />
          </div>
          <div>
            <h3 className="admin-danger-title">
              Danger Zone: {targetUser.isDeleted ? "Permanently Delete Account" : "Delete User Account"}
            </h3>
            <p className="admin-danger-desc">
              {targetUser.isDeleted
                ? `@${targetUser.username} is already deactivated. This will permanently remove the account and all of its posts, images, comments, likes, bookmarks, and follows. This cannot be reversed.`
                : `Deactivate @${targetUser.username}'s account and hide their posts. The account and posts stay in the database and can be restored later from the Deleted Users view.`}
            </p>
          </div>
        </div>

        <div className="admin-danger-action-row">
          {isSelf ? (
            <span className="admin-danger-disabled-hint">
              You cannot delete your own admin account.
            </span>
          ) : isTargetAdmin ? (
            <span className="admin-danger-disabled-hint">
              Another administrator account cannot be deleted. Demote role first if necessary.
            </span>
          ) : null}

          {targetUser.isDeleted ? (
            <button
              type="button"
              className="admin-danger-delete-btn"
              disabled={!canDeleteUser}
              onClick={() => {
                setConfirmPurgeInput("");
                setShowPurgeUserModal(true);
              }}
            >
              <Trash2 size={16} />
              <span>Permanently Delete Account</span>
            </button>
          ) : (
            <button
              type="button"
              className="admin-danger-delete-btn"
              disabled={!canDeleteUser}
              onClick={() => {
                setConfirmUsernameInput("");
                setShowDeleteUserModal(true);
              }}
            >
              <Trash2 size={16} />
              <span>Delete User Account</span>
            </button>
          )}
        </div>
      </section>

      {/* Delete Post Confirm Dialog (soft delete) */}
      <ConfirmDialog
        isOpen={Boolean(postToDelete)}
        title="Delete this post?"
        message={`"${postToDelete?.title}" will be hidden from the site and moved to Deleted Posts. You can restore it later.`}
        confirmText="Delete Post"
        loading={deletingPost}
        onConfirm={handleDeletePost}
        onClose={() => setPostToDelete(null)}
      />

      {/* Permanently Delete Post Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(postToPurge)}
        title="Delete this post forever?"
        message={`"${postToPurge?.title}" and all of its comments, likes, and images will be permanently removed. This cannot be undone.`}
        confirmText="Delete Forever"
        loading={purgingPost}
        onConfirm={handlePurgePost}
        onClose={() => setPostToPurge(null)}
      />

      {/* Delete User Typed Confirmation Modal */}
      {showDeleteUserModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowDeleteUserModal(false)}>
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon-danger">
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <h2 id="delete-user-modal-title" className="admin-modal-title">
                Confirm User Deletion
              </h2>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setShowDeleteUserModal(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <p className="admin-modal-warning-text">
                This will deactivate <strong>@{targetUser.username}</strong> and hide{" "}
                <strong>{counts.posts} posts</strong>. The account, posts, and comments stay in the
                database and can be restored later from the Deleted Users view.
              </p>
              <p className="admin-modal-instruction">
                Please type <strong style={{ color: "#dc2626" }}>{targetUser.username}</strong> below to confirm:
              </p>

              <input
                type="text"
                value={confirmUsernameInput}
                onChange={(e) => setConfirmUsernameInput(e.target.value)}
                placeholder={targetUser.username}
                className="admin-modal-confirm-input"
                autoFocus
              />
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-cancel-btn"
                onClick={() => setShowDeleteUserModal(false)}
                disabled={deletingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-destructive-btn"
                disabled={confirmUsernameInput !== targetUser.username || deletingUser}
                onClick={handleDeleteUser}
              >
                {deletingUser ? "Deleting user..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent User Deletion Modal (only reachable once already soft-deleted) */}
      {showPurgeUserModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowPurgeUserModal(false)}>
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-user-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon-danger">
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <h2 id="purge-user-modal-title" className="admin-modal-title">
                Confirm Permanent Deletion
              </h2>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setShowPurgeUserModal(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <p className="admin-modal-warning-text">
                This will permanently delete <strong>@{targetUser.username}</strong>, along with{" "}
                <strong>{counts.posts} posts</strong>, all their comments, media assets from
                Cloudinary, and notifications. This cannot be undone.
              </p>
              <p className="admin-modal-instruction">
                Please type <strong style={{ color: "#dc2626" }}>{targetUser.username}</strong> below to confirm:
              </p>

              <input
                type="text"
                value={confirmPurgeInput}
                onChange={(e) => setConfirmPurgeInput(e.target.value)}
                placeholder={targetUser.username}
                className="admin-modal-confirm-input"
                autoFocus
              />
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-cancel-btn"
                onClick={() => setShowPurgeUserModal(false)}
                disabled={purgingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-destructive-btn"
                disabled={confirmPurgeInput !== targetUser.username || purgingUser}
                onClick={handlePurgeUser}
              >
                {purgingUser ? "Deleting user..." : "Permanently Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
