import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { PageHeader, FilterSelect, Pagination, TableState, RoleBadge, formatDate, humanize } from "./AdminShared";

const TARGET_TYPES = ["user", "post", "comment", "report", "category", "setting"];

export default function AdminActivity() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  useEffect(() => setPage(1), [action, targetType, from, to]);

  const dateOk = !from || !to || from <= to;
  const params = { action, targetType, from, to, page };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminAudit(params),
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), limit: "25" });
      if (action) q.set("action", action);
      if (targetType) q.set("targetType", targetType);
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return apiQuery(`/admin/audit-logs?${q}`);
    },
    enabled: dateOk,
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev,
  });
  const logs = data?.logs || [];
  const actions = data?.actions || [];

  return (
    <div className="admin-page-container">
      <PageHeader
        title="Activity Logs"
        subtitle={data?.scope === "moderator" ? "Your moderation actions. The log is append-only." : "Every staff action, newest first. The log is append-only and cannot be edited."}
      />
      <div className="ax-toolbar">
        <FilterSelect label="Action" value={action} onChange={setAction} options={[{ value: "", label: "All actions" }, ...actions.map((a) => ({ value: a, label: humanize(a) }))]} />
        <FilterSelect label="Target" value={targetType} onChange={setTargetType} options={[{ value: "", label: "All targets" }, ...TARGET_TYPES.map((t) => ({ value: t, label: humanize(t) }))]} />
        <label className="ax-select">
          <span className="ax-select-label">From</span>
          <input className="ax-input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="ax-select">
          <span className="ax-select-label">To</span>
          <input className="ax-input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {!dateOk && <p className="ax-muted">The start date must be on or before the end date.</p>}

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th aria-label="Details" />
                <th>When</th>
                <th>Staff</th>
                <th>Action</th>
                <th>Target</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              <TableState isLoading={isLoading} isError={isError} error={error} onRetry={refetch} isEmpty={logs.length === 0} emptyText="No activity recorded for these filters." colSpan={6}>
                {logs.flatMap((log) => {
                  const expanded = open === log._id;
                  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;
                  const rows = [
                    <tr key={log._id}>
                      <td>
                        {hasMeta && (
                          <button type="button" className="ax-icon-btn" aria-expanded={expanded} aria-label="Toggle details" onClick={() => setOpen(expanded ? null : log._id)}>
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                      </td>
                      <td className="admin-table-date">{formatDate(log.createdAt, true)}</td>
                      <td>
                        {log.actorUsername ? `@${log.actorUsername}` : "System"} {log.actorRole && log.actorRole !== "system" && <RoleBadge role={log.actorRole} />}
                      </td>
                      <td>{humanize(log.action)}</td>
                      <td>
                        <span className="ax-cell-text" title={log.targetLabel || ""}>
                          {humanize(log.targetType)}
                          {log.targetLabel ? `: ${log.targetLabel}` : ""}
                        </span>
                      </td>
                      <td>
                        <span className="ax-cell-text ax-cell-wrap">{log.reason || "—"}</span>
                      </td>
                    </tr>,
                  ];
                  if (expanded) {
                    rows.push(
                      <tr key={`${log._id}-meta`}>
                        <td colSpan={6}>
                          <pre className="ax-quote">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </TableState>
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="entries" />
      </div>
    </div>
  );
}
