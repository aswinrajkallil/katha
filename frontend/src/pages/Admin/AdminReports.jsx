import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserCheck, UserMinus, Eye } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { useAdminAccess } from "./adminAccess";
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  Tabs,
  Pagination,
  TableState,
  ErrorBox,
  StatusPill,
  RoleBadge,
  useDebounced,
  mutationRequest,
  formatDate,
  humanize,
} from "./AdminShared";

const LIMIT = 10;
const REASONS = ["spam", "harassment", "hate_speech", "inappropriate_content", "impersonation", "copyright_violation", "misinformation", "other"];

function targetLink(report) {
  if (report.targetType === "user") return `/admin/users/${report.targetId}`;
  if (report.targetType === "post") return `/post/${report.targetId}`;
  return null;
}

function ResolvePanel({ report, targetType, onDone }) {
  const toast = useToast();
  const { can } = useAdminAccess();
  const [outcome, setOutcome] = useState("resolved");
  const [action, setAction] = useState("none");
  const [resolution, setResolution] = useState("");
  const mutation = useMutation({
    mutationFn: () => mutationRequest(apiFetch, `/admin/reports/${report._id}/resolve`, { method: "POST", body: { outcome, action: outcome === "dismissed" ? "none" : action, resolution: resolution.trim() } }),
    onSuccess: (r) => {
      toast.success(r.message || "Report closed");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const canDeactivate = targetType === "user" && can("users:deactivate");
  const destructive = outcome === "resolved" && action !== "none";
  const [confirmed, setConfirmed] = useState(false);
  const valid = resolution.trim().length >= 3 && (!destructive || confirmed);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
      className="ax-panel"
      style={{ marginTop: 16 }}
    >
      <h2>Close this report</h2>
      <label className="ax-field">
        <span className="ax-field-label">Outcome</span>
        <select
          className="ax-input"
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value);
            setConfirmed(false);
          }}
        >
          <option value="resolved">Resolve — a violation was confirmed</option>
          <option value="dismissed">Dismiss — no violation</option>
        </select>
      </label>
      {outcome === "resolved" && (
        <label className="ax-field">
          <span className="ax-field-label">Moderation action</span>
          <select
            className="ax-input"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setConfirmed(false);
            }}
          >
            <option value="none">No further action</option>
            {targetType !== "user" && <option value="remove_content">Remove the reported {targetType}</option>}
            {canDeactivate && <option value="deactivate_account">Deactivate the account</option>}
          </select>
        </label>
      )}
      <label className="ax-field">
        <span className="ax-field-label">Resolution note (required)</span>
        <textarea className="ax-textarea" rows={3} maxLength={1000} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      </label>
      {destructive && (
        <label className="ax-muted" style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I understand this action takes effect immediately and is recorded in the activity log.
        </label>
      )}
      <div className="ax-row-actions" style={{ marginTop: 12 }}>
        <button type="submit" className={`ax-btn ${destructive ? "ax-btn-danger" : "ax-btn-primary"}`} disabled={!valid || mutation.isPending}>
          {mutation.isPending ? "Saving…" : outcome === "dismissed" ? "Dismiss report" : destructive ? "Resolve & apply action" : "Resolve report"}
        </button>
      </div>
    </form>
  );
}

function ReportDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminReport(id),
    queryFn: () => apiQuery(`/admin/reports/${id}`),
  });
  const assign = useMutation({
    mutationFn: (assignTo) => mutationRequest(apiFetch, `/admin/reports/${id}/assign`, { method: "PATCH", body: { assignTo } }),
    onSuccess: (r) => {
      toast.success(r.message);
      refetch();
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  const report = data?.report;
  const target = data?.target;
  const open = report && ["pending", "under_review"].includes(report.status);

  return (
    <div className="ax-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ax-modal" role="dialog" aria-modal="true" aria-label="Report details">
        <div className="ax-modal-head">
          <h2>Report details</h2>
          <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {isLoading && <div className="skeleton-line" style={{ height: 80 }} />}
        {isError && <ErrorBox title="Unable to load report" error={error} onRetry={refetch} />}
        {report && (
          <>
            <p>
              <StatusPill status={report.status} /> <strong>{humanize(report.reason)}</strong> · {humanize(report.targetType)} ·{" "}
              <span className="ax-muted">{formatDate(report.createdAt, true)}</span>
            </p>
            <p className="ax-muted">
              Reported by {report.reporter ? `@${report.reporter.username}` : "a removed account"}
              {data.otherReports > 0 && ` · ${data.otherReports} other report${data.otherReports === 1 ? "" : "s"} on the same ${report.targetType}`}
            </p>
            {report.description && <div className="ax-quote">{report.description}</div>}

            <h3 style={{ marginTop: 16 }}>Reported {report.targetType}</h3>
            {!target?.exists ? (
              <p className="ax-muted">This {report.targetType} no longer exists.</p>
            ) : (
              <div className="ax-quote">
                {report.targetType === "user" ? (
                  <>
                    @{target.username} {target.role && <RoleBadge role={target.role} />}
                    {target.isDeleted && " (deactivated)"}
                    {target.bio && <div className="ax-muted">{target.bio}</div>}
                  </>
                ) : (
                  <>
                    {report.targetType === "post" && <strong>{target.title}</strong>}
                    <div>{report.targetType === "post" ? target.excerpt || (target.content || "").slice(0, 400) : target.content}</div>
                    <div className="ax-muted">
                      by {target.author ? `@${target.author.username}` : "unknown"} {target.isDeleted && "· currently removed"}
                      {target.moderationReason && ` · Reason: ${target.moderationReason}`}
                    </div>
                  </>
                )}
              </div>
            )}
            {targetLink(report) && (
              <p>
                <Link className="ax-link-btn" to={targetLink(report)} target="_blank" rel="noopener noreferrer">
                  Open {report.targetType}
                </Link>
              </p>
            )}

            <p className="ax-muted">
              Assigned to: {report.assignedTo ? `@${report.assignedTo.username}` : "nobody"}
              {report.resolution && (
                <>
                  <br />
                  Resolution: {report.resolution}
                </>
              )}
            </p>

            {open && (
              <div className="ax-row-actions">
                {report.permissions?.canAssign && (
                  <button type="button" className="ax-btn" disabled={assign.isPending} onClick={() => assign.mutate("me")}>
                    <UserCheck size={14} /> Assign to me
                  </button>
                )}
                {report.permissions?.canAssign && report.assignedTo && (
                  <button type="button" className="ax-btn" disabled={assign.isPending} onClick={() => assign.mutate(null)}>
                    <UserMinus size={14} /> Unassign
                  </button>
                )}
              </div>
            )}
            {open && report.permissions?.canResolve && (
              <ResolvePanel
                report={report}
                targetType={report.targetType}
                onDone={() => {
                  onChanged();
                  onClose();
                }}
              />
            )}
            {open && !report.permissions?.canResolve && <p className="ax-muted">This report is assigned to another moderator.</p>}

            {data.history?.length > 0 && (
              <>
                <h3 style={{ marginTop: 16 }}>History</h3>
                <ul className="ax-history">
                  {data.history.map((h) => (
                    <li key={h._id}>
                      <time dateTime={h.createdAt}>{formatDate(h.createdAt, true)}</time>
                      <strong>{humanize(h.action)}</strong> by {h.actorUsername ? `@${h.actorUsername}` : "system"}
                      {h.reason && <div className="ax-muted">{h.reason}</div>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("open");
  const [reason, setReason] = useState("");
  const [targetType, setTargetType] = useState("");
  const [assigned, setAssigned] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => setPage(1), [tab, reason, targetType, assigned, search]);

  const params = { tab, reason, targetType, assigned, search, page };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminReports(params),
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (tab !== "all") q.set("status", tab);
      if (reason) q.set("reason", reason);
      if (targetType) q.set("targetType", targetType);
      if (assigned) q.set("assigned", assigned);
      if (search) q.set("search", search);
      return apiQuery(`/admin/reports?${q}`);
    },
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev,
  });
  const reports = data?.reports || [];

  const changed = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "report"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
    queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
  };

  return (
    <div className="admin-page-container">
      <PageHeader title="Reports" subtitle="Review what members have flagged and decide what happens next" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Open", count: data?.openCount },
          { value: "resolved", label: "Resolved" },
          { value: "dismissed", label: "Dismissed" },
          { value: "all", label: "All" },
        ]}
      />
      <div className="ax-toolbar">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search reported item or details..." label="Search reports" />
        <FilterSelect label="Reason" value={reason} onChange={setReason} options={[{ value: "", label: "All reasons" }, ...REASONS.map((r) => ({ value: r, label: humanize(r) }))]} />
        <FilterSelect
          label="Type"
          value={targetType}
          onChange={setTargetType}
          options={[
            { value: "", label: "All types" },
            { value: "post", label: "Posts" },
            { value: "comment", label: "Comments" },
            { value: "user", label: "Profiles" },
          ]}
        />
        <FilterSelect
          label="Assignment"
          value={assigned}
          onChange={setAssigned}
          options={[
            { value: "", label: "Anyone" },
            { value: "me", label: "Assigned to me" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
      </div>

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reported item</th>
                <th>Reason</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableState isLoading={isLoading} isError={isError} error={error} onRetry={refetch} isEmpty={reports.length === 0} emptyText="No reports match these filters." colSpan={7}>
                {reports.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <span className="ax-cell-text" title={r.targetLabel}>
                        {r.targetLabel || humanize(r.targetType)}
                      </span>
                      <span className="ax-muted">{humanize(r.targetType)}</span>
                    </td>
                    <td>{humanize(r.reason)}</td>
                    <td>{r.reporter ? `@${r.reporter.username}` : "—"}</td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td>{r.assignedTo ? `@${r.assignedTo.username}` : "—"}</td>
                    <td className="admin-table-date">{formatDate(r.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="admin-post-action-btn view" onClick={() => setSelected(r._id)}>
                        <Eye size={15} />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="reports" />
      </div>

      {selected && <ReportDetail id={selected} onClose={() => setSelected(null)} onChanged={changed} />}
    </div>
  );
}
