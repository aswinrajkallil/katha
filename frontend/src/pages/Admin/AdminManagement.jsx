import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  Pagination,
  TableState,
  RoleBadge,
  StatusPill,
  useDebounced,
  mutationRequest,
  formatDate,
} from "./AdminShared";
import { StatTile } from "./AdminCharts";

// Role changes are always confirmed with a reason field; the API additionally requires confirm:true.
function RoleChangeDialog({ change, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const { user, role, newRole } = change;
  const promote = role === "user";
  const label = newRole === "user" ? "normal user" : newRole;
  const mutation = useMutation({
    mutationFn: () =>
      mutationRequest(apiFetch, `/admin/management/users/${user._id}/role`, {
        method: "PATCH",
        body: { role: newRole, confirm: true, reason: reason.trim() },
      }),
    onSuccess: (r) => {
      toast.success(r.message || "Role updated");
      onDone();
    },
    onError: (e) => {
      toast.error(e.message);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      isOpen
      title={promote ? `Make @${user.username} ${label === "admin" ? "an admin" : `a ${label}`}?` : `Remove ${role} access from @${user.username}?`}
      message={
        promote
          ? `They will gain access to the admin console immediately. Role: ${label}.`
          : "They become a normal user. Their access ends immediately, even if they are signed in right now."
      }
      confirmText={promote ? "Grant role" : "Remove access"}
      danger={!promote}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    >
      <label className="ax-field">
        <span className="ax-field-label">Reason (optional)</span>
        <textarea className="ax-textarea" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the activity log" />
      </label>
    </ConfirmDialog>
  );
}

function PromotePanel({ onPick }) {
  const [input, setInput] = useState("");
  const search = useDebounced(input.trim());
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.adminUsers({ promote: search }),
    queryFn: () => apiQuery(`/admin/users?role=user&status=active&limit=5&search=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
    staleTime: 15 * 1000,
  });
  const users = data?.users || [];
  return (
    <section className="ax-panel" style={{ marginBottom: 20 }} aria-label="Add staff member">
      <h2>Add a staff member</h2>
      <p className="ax-muted">Search for an existing member by username, name or email, then grant a role. Roles can only be granted to people who already have an account.</p>
      <SearchInput value={input} onChange={setInput} placeholder="Search members (min. 2 characters)..." label="Search members to promote" />
      {search.length >= 2 && (
        <ul className="ax-history" style={{ marginTop: 12 }}>
          {isFetching && users.length === 0 && <li className="ax-muted">Searching…</li>}
          {!isFetching && users.length === 0 && <li className="ax-muted">No matching normal users.</li>}
          {users.map((u) => (
            <li key={u._id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <UserAvatar user={u} size={28} />
              <span style={{ flex: "1 1 160px" }}>
                {u.fullName || u.username} <span className="ax-muted">@{u.username} · {u.email}</span>
              </span>
              <button type="button" className="ax-btn" onClick={() => onPick({ user: u, role: "user", newRole: "moderator" })}>
                <UserPlus size={14} /> Moderator
              </button>
              <button type="button" className="ax-btn" onClick={() => onPick({ user: u, role: "user", newRole: "admin" })}>
                <UserPlus size={14} /> Admin
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminManagement() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [change, setChange] = useState(null);
  useEffect(() => setPage(1), [search, role, status]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminStaff({ search, role, status, page }),
    queryFn: () => apiQuery(`/admin/management/staff?search=${encodeURIComponent(search)}&role=${role}&status=${status}&page=${page}&limit=10`),
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev,
  });
  const staff = data?.staff || [];
  const s = data?.summary || {};

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
  };

  return (
    <div className="admin-page-container">
      <PageHeader title="Admin Management" subtitle="Grant and remove admin and moderator access. Only Super Admins can see this page." />

      <div className="ax-stat-row">
        <StatTile label="Super admins" value={s.superadmins ?? "…"} />
        <StatTile label="Admins" value={s.admins ?? "…"} />
        <StatTile label="Moderators" value={s.moderators ?? "…"} />
      </div>

      <PromotePanel onPick={setChange} />

      <div className="ax-toolbar">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search staff..." label="Search staff" />
        <FilterSelect
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "All staff" },
            { value: "superadmin", label: "Super Admin" },
            { value: "admin", label: "Admin" },
            { value: "moderator", label: "Moderator" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Active" },
            { value: "deleted", label: "Deactivated" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Role changed</th>
                <th>Last active</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableState isLoading={isLoading} isError={isError} error={error} onRetry={refetch} isEmpty={staff.length === 0} emptyText="No staff match these filters." colSpan={6}>
                {staff.map((u) => {
                  const self = String(u._id) === String(me?._id || me?.id);
                  const removable = !self && !u.isDeleted && (u.role === "admin" || u.role === "moderator");
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="admin-table-user-cell">
                          <UserAvatar user={u} size={32} />
                          <div className="admin-table-user-names">
                            <Link to={`/admin/users/${u._id}`} className="admin-table-fullname">
                              {u.fullName || u.username}
                              {self && " (you)"}
                            </Link>
                            <span className="admin-table-handle">@{u.username} · {u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td>
                        <StatusPill status={u.isDeleted ? "deleted" : "active"} />
                      </td>
                      <td className="admin-table-date">
                        {u.roleChangedAt ? formatDate(u.roleChangedAt) : "—"}
                        {u.roleChangedBy && <span className="ax-muted"> by @{u.roleChangedBy.username}</span>}
                      </td>
                      <td className="admin-table-date">{u.lastActiveAt ? formatDate(u.lastActiveAt, true) : "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        {removable ? (
                          <button type="button" className="admin-post-action-btn delete" onClick={() => setChange({ user: u, role: u.role, newRole: "user" })}>
                            <UserMinus size={15} />
                            <span>Remove access</span>
                          </button>
                        ) : (
                          <span className="ax-muted">{u.role === "superadmin" ? "Not changeable here" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </TableState>
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="staff" />
      </div>

      {change && (
        <RoleChangeDialog
          change={change}
          onClose={() => setChange(null)}
          onDone={() => {
            setChange(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
