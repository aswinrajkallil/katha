import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle } from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import { PageHeader, SearchInput, FilterSelect, Pagination, TableState, RoleBadge, StatusPill, useDebounced, formatDate } from "./AdminShared";
import "./AdminUsers.css";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "superadmin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
  { value: "user", label: "User" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deactivated" },
  { value: "all", label: "All accounts" },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => setPage(1), [search, role, status]);

  const params = { search, role, status, page, limit };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminUsers(params),
    queryFn: () =>
      apiQuery(
        `/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}&status=${status}${role ? `&role=${role}` : ""}`
      ),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });

  const users = data?.users || [];
  const open = (id) => navigate(`/admin/users/${id}`);

  return (
    <div className="admin-page-container">
      <PageHeader
        title="Users"
        subtitle={status === "deleted" ? "Deactivated accounts. Restore them or delete them for good." : "Browse accounts, roles and activity"}
      />

      <div className="ax-toolbar">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by username, full name, or email..." label="Search users" />
        <FilterSelect label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      </div>

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table admin-table-clickable">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Posts</th>
                <th>Comments</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={refetch}
                isEmpty={users.length === 0}
                emptyText={search ? `No users found matching "${search}".` : "No users match these filters."}
                colSpan={7}
              >
                {users.map((u) => (
                  <tr
                    key={u._id}
                    onClick={() => open(u._id)}
                    className="admin-clickable-row"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(u._id);
                      }
                    }}
                  >
                    <td>
                      <div className="admin-table-user-cell">
                        <UserAvatar user={u} size={36} />
                        <div className="admin-table-user-names">
                          <span className="admin-table-fullname">{u.fullName || u.username}</span>
                          <span className="admin-table-handle">@{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="admin-table-email">{u.email}</td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td>
                      <StatusPill status={u.isDeleted ? "deleted" : "active"} />
                    </td>
                    <td>
                      <div className="admin-posts-count-cell">
                        <FileText size={15} color="#64748b" />
                        <span>{u.postsCount ?? 0}</span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-posts-count-cell">
                        <MessageCircle size={15} color="#64748b" />
                        <span>{u.commentsCount ?? 0}</span>
                      </div>
                    </td>
                    <td className="admin-table-date">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} page={page} onPage={setPage} noun="users" />
      </div>
    </div>
  );
}
