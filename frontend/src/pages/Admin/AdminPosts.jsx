import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, MessageCircle, ExternalLink, Trash2, FileText, RotateCcw, Archive, Star, StarOff, Pencil, History, X, EyeOff } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import { useAdminAccess, canModerateContentOf } from "./adminAccess";
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  Tabs,
  Pagination,
  TableState,
  ErrorBox,
  ReasonDialog,
  RoleBadge,
  StatusPill,
  useDebounced,
  mutationRequest,
  formatDate,
  humanize,
} from "./AdminShared";
import "./AdminPosts.css";

const LIMIT = 10;

function PostHistoryModal({ post, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.adminPostHistory(post._id),
    queryFn: () => apiQuery(`/admin/posts/${post._id}/history`),
  });
  return (
    <div className="ax-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ax-modal" role="dialog" aria-modal="true" aria-label="Post history">
        <div className="ax-modal-head">
          <div>
            <h2>Moderation history</h2>
            <p className="ax-muted">{post.title}</p>
          </div>
          <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {isLoading && <div className="skeleton-line" style={{ height: 60 }} />}
        {isError && <ErrorBox title="Unable to load history" error={error} />}
        {data && data.history.length === 0 && <p className="ax-muted">No moderation activity recorded for this post.</p>}
        {data && data.history.length > 0 && (
          <ul className="ax-history">
            {data.history.map((h) => (
              <li key={h._id}>
                <time dateTime={h.createdAt}>{formatDate(h.createdAt, true)}</time>
                <strong>{humanize(h.action)}</strong> by {h.actorUsername ? `@${h.actorUsername}` : "system"}
                {h.reason && <div className="ax-muted">Reason: {h.reason}</div>}
              </li>
            ))}
          </ul>
        )}
        {data?.revisions?.length > 0 && (
          <>
            <h3 style={{ marginTop: 18 }}>Previous versions ({data.revisions.length})</h3>
            <ul className="ax-history">
              {data.revisions.map((r) => (
                <li key={r._id}>
                  <time dateTime={r.createdAt}>{formatDate(r.createdAt, true)}</time>
                  Changed: {(r.changedFields || []).join(", ") || "—"}
                  {r.reason && <div className="ax-muted">Reason: {r.reason}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function EditPostModal({ post, categories, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: post.title || "",
    excerpt: post.excerpt || "",
    tags: (post.tags || []).join(", "),
    category: post.category?._id || "",
    reason: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      mutationRequest(apiFetch, `/admin/posts/${post._id}`, {
        method: "PATCH",
        body: {
          title: form.title,
          excerpt: form.excerpt,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          category: form.category || null,
          reason: form.reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Post updated");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = form.title.trim() && form.reason.trim().length >= 3;
  return (
    <div className="ax-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="ax-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit post"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <div className="ax-modal-head">
          <h2>Edit post (admin)</h2>
          <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="ax-muted">The original is kept in the post's history and the change is recorded in the activity log.</p>
        <label className="ax-field">
          <span className="ax-field-label">Title</span>
          <input className="ax-input" value={form.title} onChange={set("title")} maxLength={200} required />
        </label>
        <label className="ax-field">
          <span className="ax-field-label">Excerpt</span>
          <textarea className="ax-textarea" rows={3} value={form.excerpt} onChange={set("excerpt")} />
        </label>
        <label className="ax-field">
          <span className="ax-field-label">Tags (comma separated)</span>
          <input className="ax-input" value={form.tags} onChange={set("tags")} />
        </label>
        <label className="ax-field">
          <span className="ax-field-label">Category</span>
          <select className="ax-input" value={form.category} onChange={set("category")}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ax-field">
          <span className="ax-field-label">Reason (required)</span>
          <textarea className="ax-textarea" rows={2} value={form.reason} onChange={set("reason")} maxLength={1000} />
        </label>
        <div className="ax-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="ax-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ax-btn ax-btn-primary" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPosts() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, role } = useAdminAccess();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState("");
  const [view, setView] = useState("active");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { type: remove|purge|feature|unfeature|status, post }
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);

  const showDeleted = view === "deleted";
  useEffect(() => setPage(1), [search, statusFilter, featuredFilter, view]);

  const params = { page, status: statusFilter, search, deleted: showDeleted, featured: featuredFilter };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminPosts(params),
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter && !showDeleted) q.set("status", statusFilter);
      if (featuredFilter && !showDeleted) q.set("featured", featuredFilter);
      if (search) q.set("search", search);
      if (showDeleted) q.set("deleted", "true");
      return apiQuery(`/admin/posts?${q}`);
    },
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => apiQuery("/categories"),
    staleTime: 5 * 60 * 1000,
    enabled: can("posts:edit"),
  });

  const posts = data?.posts || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "featured"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
  };

  const act = useMutation({
    mutationFn: ({ type, post, reason }) => {
      const id = post._id;
      switch (type) {
        case "remove":
          return mutationRequest(apiFetch, `/admin/posts/${id}`, { method: "DELETE", body: { reason } });
        case "restore":
          return mutationRequest(apiFetch, `/admin/posts/${id}/restore`, { method: "PATCH", body: { reason } });
        case "purge":
          return mutationRequest(apiFetch, `/admin/posts/${id}/permanent`, { method: "DELETE", body: { reason } });
        case "feature":
        case "unfeature":
          return mutationRequest(apiFetch, `/admin/posts/${id}/feature`, { method: "PATCH", body: { featured: type === "feature", reason } });
        case "publish":
        case "unpublish":
          return mutationRequest(apiFetch, `/admin/posts/${id}/status`, {
            method: "PATCH",
            body: { status: type === "publish" ? "published" : "draft", reason },
          });
        default:
          throw new Error("Unknown action");
      }
    },
    onSuccess: (res) => {
      toast.success(res.message || "Done");
      setDialog(null);
      refresh();
    },
    onError: (e) => {
      toast.error(e.message || "Action failed");
      setDialog(null);
    },
  });

  const DIALOGS = {
    remove: { title: "Remove this post?", confirm: "Remove post", required: true, text: (p) => `"${p.title}" will be hidden from the site and moved to Removed Posts. It can be restored.` },
    purge: { title: "Delete this post forever?", confirm: "Delete forever", required: true, text: (p) => `"${p.title}" and its comments, likes and images will be permanently removed. This cannot be undone.` },
    unpublish: { title: "Unpublish this post?", confirm: "Unpublish", required: true, text: (p) => `"${p.title}" will return to draft and disappear from the public site.` },
    publish: { title: "Publish this post?", confirm: "Publish", required: false, danger: false, text: (p) => `"${p.title}" will become visible on the public site.` },
    feature: { title: "Feature this post?", confirm: "Feature", required: false, danger: false, text: (p) => `"${p.title}" will appear in featured posts once published.` },
    unfeature: { title: "Remove from featured?", confirm: "Unfeature", required: false, danger: false, text: (p) => `"${p.title}" will no longer be featured.` },
    restore: { title: "Restore this post?", confirm: "Restore", required: false, danger: false, text: (p) => `"${p.title}" will be visible again.` },
  };
  const current = dialog ? DIALOGS[dialog.type] : null;

  return (
    <div className="admin-page-container">
      <PageHeader
        title="Posts Moderation"
        subtitle={showDeleted ? "Removed posts. Restore them or delete them for good." : "Search, inspect, feature and moderate posts across the platform"}
      />

      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: "active", label: "Active Posts", icon: <FileText size={14} /> },
          { value: "deleted", label: "Removed Posts", icon: <Archive size={14} /> },
        ]}
      />

      <div className="ax-toolbar">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by title, excerpt, or tags..." label="Search posts" />
        {!showDeleted && (
          <>
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All statuses" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Drafts" },
              ]}
            />
            {can("posts:feature") && (
              <FilterSelect
                label="Featured"
                value={featuredFilter}
                onChange={setFeaturedFilter}
                options={[
                  { value: "", label: "Any" },
                  { value: "true", label: "Featured" },
                  { value: "false", label: "Not featured" },
                ]}
              />
            )}
          </>
        )}
      </div>

      {isError && !data ? (
        <ErrorBox title="Unable to load posts" error={error} onRetry={refetch} />
      ) : (
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
                <TableState
                  isLoading={isLoading}
                  isError={isError}
                  error={error}
                  onRetry={refetch}
                  isEmpty={posts.length === 0}
                  emptyText={showDeleted ? "No removed posts." : "No posts found matching the filter."}
                  colSpan={8}
                >
                  {posts.map((post) => {
                    const mayAct = canModerateContentOf(role, post.author?.role);
                    return (
                      <tr key={post._id}>
                        <td className="admin-post-title-cell">
                          <span className="admin-post-title-text" title={post.title}>
                            {post.isFeatured && <Star size={13} color="#e8590c" aria-label="Featured" style={{ marginRight: 4 }} />}
                            {post.title}
                          </span>
                          {post.category?.name && <span className="admin-post-category-tag">{post.category.name}</span>}
                          {post.moderationReason && showDeleted && <span className="ax-muted">Reason: {post.moderationReason}</span>}
                        </td>
                        <td>
                          {post.author ? (
                            <Link to={`/admin/users/${post.author._id}`} className="admin-post-author-link">
                              <UserAvatar user={post.author} size={24} />
                              <div className="admin-post-author-info">
                                <span className="admin-post-author-name">{post.author.fullName || post.author.username}</span>
                                <span className="admin-post-author-handle">@{post.author.username}</span>
                              </div>
                              {post.author.role && post.author.role !== "user" && <RoleBadge role={post.author.role} />}
                            </Link>
                          ) : (
                            <span className="admin-deleted-author">[deleted author]</span>
                          )}
                        </td>
                        <td>
                          <StatusPill status={showDeleted ? "removed" : post.status} />
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
                          <div className="ax-row-actions">
                            {!showDeleted && (
                              <Link to={`/post/${post._id}`} target="_blank" rel="noopener noreferrer" className="admin-post-action-btn view" title="View post on site">
                                <ExternalLink size={15} />
                                <span>View</span>
                              </Link>
                            )}
                            <button type="button" className="admin-post-action-btn" onClick={() => setHistory(post)} title="Moderation history">
                              <History size={15} />
                              <span>History</span>
                            </button>
                            {!showDeleted && mayAct && can("posts:edit") && (
                              <button type="button" className="admin-post-action-btn" onClick={() => setEditing(post)}>
                                <Pencil size={15} />
                                <span>Edit</span>
                              </button>
                            )}
                            {!showDeleted && mayAct && can("posts:publish") && (
                              <button
                                type="button"
                                className="admin-post-action-btn"
                                onClick={() => setDialog({ type: post.status === "published" ? "unpublish" : "publish", post })}
                              >
                                {post.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}
                                <span>{post.status === "published" ? "Unpublish" : "Publish"}</span>
                              </button>
                            )}
                            {!showDeleted && mayAct && can("posts:feature") && post.status === "published" && (
                              <button type="button" className="admin-post-action-btn" onClick={() => setDialog({ type: post.isFeatured ? "unfeature" : "feature", post })}>
                                {post.isFeatured ? <StarOff size={15} /> : <Star size={15} />}
                                <span>{post.isFeatured ? "Unfeature" : "Feature"}</span>
                              </button>
                            )}
                            {showDeleted && mayAct && can("posts:restore") && (
                              <button type="button" className="admin-post-action-btn" onClick={() => setDialog({ type: "restore", post })}>
                                <RotateCcw size={15} />
                                <span>Restore</span>
                              </button>
                            )}
                            {showDeleted && mayAct && can("posts:purge") && (
                              <button type="button" className="admin-post-action-btn delete" onClick={() => setDialog({ type: "purge", post })}>
                                <Trash2 size={15} />
                                <span>Delete Forever</span>
                              </button>
                            )}
                            {!showDeleted && mayAct && can("posts:remove") && (
                              <button type="button" className="admin-post-action-btn delete" onClick={() => setDialog({ type: "remove", post })}>
                                <Trash2 size={15} />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </TableState>
              </tbody>
            </table>
          </div>
          <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="posts" />
        </div>
      )}

      {current && (
        <ReasonDialog
          isOpen
          title={current.title}
          message={current.text(dialog.post)}
          confirmText={current.confirm}
          danger={current.danger !== false}
          reasonRequired={current.required || role === "moderator"}
          loading={act.isPending}
          onConfirm={(reason) => act.mutate({ type: dialog.type, post: dialog.post, reason })}
          onClose={() => setDialog(null)}
        />
      )}
      {editing && (
        <EditPostModal
          post={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {history && <PostHistoryModal post={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
