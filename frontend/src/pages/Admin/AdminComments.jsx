import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, ExternalLink, MessageCircle, Flag } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { useAdminAccess } from "./adminAccess";
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  Pagination,
  TableState,
  ReasonDialog,
  RoleBadge,
  StatusPill,
  useDebounced,
  mutationRequest,
  formatDate,
} from "./AdminShared";

const LIMIT = 10;

export default function AdminComments() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { role } = useAdminAccess();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [authorInput, setAuthorInput] = useState("");
  const author = useDebounced(authorInput.trim());
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  useEffect(() => setPage(1), [search, author, status]);

  const params = { search, author, status, page };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminComments(params),
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT), status });
      if (search) q.set("search", search);
      if (author) q.set("author", author);
      return apiQuery(`/admin/comments?${q}`);
    },
    staleTime: 20 * 1000,
    placeholderData: (prev) => prev,
  });
  const comments = data?.comments || [];

  const act = useMutation({
    mutationFn: ({ type, comment, reason }) => {
      const id = comment._id;
      if (type === "remove") return mutationRequest(apiFetch, `/admin/comments/${id}`, { method: "DELETE", body: { reason } });
      if (type === "restore") return mutationRequest(apiFetch, `/admin/comments/${id}/restore`, { method: "PATCH", body: { reason } });
      return mutationRequest(apiFetch, `/admin/comments/${id}/permanent`, { method: "DELETE", body: { reason } });
    },
    onSuccess: (res) => {
      toast.success(res.message || "Done");
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    },
    onError: (e) => {
      toast.error(e.message || "Action failed");
      setDialog(null);
    },
  });

  const DIALOGS = {
    remove: { title: "Remove this comment?", confirm: "Remove comment", required: true, danger: true, text: "The comment is hidden from the site. Its text is kept so it can be restored." },
    restore: { title: "Restore this comment?", confirm: "Restore", required: false, danger: false, text: "The comment becomes visible again." },
    purge: { title: "Delete this comment forever?", confirm: "Delete forever", required: true, danger: true, text: "The comment is permanently removed. If it has replies, a placeholder stays so the thread keeps its shape. This cannot be undone." },
  };
  const current = dialog ? DIALOGS[dialog.type] : null;

  return (
    <div className="admin-page-container">
      <PageHeader title="Comments Moderation" subtitle="Review, remove and restore comments across the platform" />

      <div className="ax-toolbar">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search comment text..." label="Search comments" />
        <label className="ax-select">
          <span className="ax-select-label">Author (username or id)</span>
          <input className="ax-input" value={authorInput} onChange={(e) => setAuthorInput(e.target.value)} placeholder="username" />
        </label>
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Visible" },
            { value: "deleted", label: "Removed" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Comment</th>
                <th>Author</th>
                <th>Post</th>
                <th>Status</th>
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
                isEmpty={comments.length === 0}
                emptyText="No comments match these filters."
                colSpan={6}
              >
                {comments.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <span className="ax-cell-text ax-cell-wrap" title={c.content}>
                        {c.content}
                      </span>
                      <span className="ax-muted">
                        <MessageCircle size={12} /> {c.repliesCount} repl{c.repliesCount === 1 ? "y" : "ies"} · {c.likesCount} like{c.likesCount === 1 ? "" : "s"}
                        {c.openReports > 0 && (
                          <>
                            {" · "}
                            <Link to="/admin/reports" className="ax-link-btn">
                              <Flag size={12} /> {c.openReports} open report{c.openReports === 1 ? "" : "s"}
                            </Link>
                          </>
                        )}
                      </span>
                      {c.isDeleted && c.moderationReason && <span className="ax-muted"> · Reason: {c.moderationReason}</span>}
                    </td>
                    <td>
                      {c.author ? (
                        <span className="ax-user-mini">
                          <Link to={`/admin/users/${c.author._id}`} className="admin-post-author-link">
                            @{c.author.username}
                          </Link>
                          {c.author.role !== "user" && <RoleBadge role={c.author.role} />}
                        </span>
                      ) : (
                        <span className="admin-deleted-author">[deleted author]</span>
                      )}
                    </td>
                    <td>
                      {c.post ? (
                        <Link to={`/post/${c.post._id}`} target="_blank" rel="noopener noreferrer" className="admin-post-author-link">
                          <span className="ax-cell-text" style={{ maxWidth: 180 }}>
                            {c.post.title}
                          </span>
                          <ExternalLink size={12} />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <StatusPill status={c.isDeleted ? "removed" : "visible"} />
                    </td>
                    <td className="admin-table-date">{formatDate(c.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="ax-row-actions">
                        {c.permissions?.canRemove && (
                          <button type="button" className="admin-post-action-btn delete" onClick={() => setDialog({ type: "remove", comment: c })}>
                            <Trash2 size={15} />
                            <span>Remove</span>
                          </button>
                        )}
                        {c.permissions?.canRestore && (
                          <button type="button" className="admin-post-action-btn" onClick={() => setDialog({ type: "restore", comment: c })}>
                            <RotateCcw size={15} />
                            <span>Restore</span>
                          </button>
                        )}
                        {c.permissions?.canPurge && (
                          <button type="button" className="admin-post-action-btn delete" onClick={() => setDialog({ type: "purge", comment: c })}>
                            <Trash2 size={15} />
                            <span>Delete Forever</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="comments" />
      </div>

      {current && (
        <ReasonDialog
          isOpen
          title={current.title}
          message={current.text}
          confirmText={current.confirm}
          danger={current.danger}
          reasonRequired={current.required || role === "moderator"}
          loading={act.isPending}
          onConfirm={(reason) => act.mutate({ type: dialog.type, comment: dialog.comment, reason })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
