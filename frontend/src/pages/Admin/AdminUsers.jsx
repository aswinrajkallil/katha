import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import "./AdminUsers.css";

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

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  // 300ms debounce for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminUsers({ search: debouncedSearch, page, limit }),
    queryFn: () =>
      apiQuery(
        `/admin/users?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${limit}`
      ),
    staleTime: 30 * 1000,
  });

  const users = data?.users || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit, totalPages: 1 };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div className="admin-header-title-wrap">
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-subtitle">Manage user accounts, roles, and privileges</p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="admin-users-toolbar">
        <div className="admin-search-box">
          <Search size={18} className="admin-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by username, full name, or email..."
            aria-label="Search users"
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
      </div>

      {/* Users Table */}
      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table admin-table-clickable">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Posts</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="admin-table-skeleton-row">
                    <td colSpan={5}>
                      <div className="skeleton-line" style={{ height: 28 }} />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    <div style={{ color: "#dc2626", marginBottom: 8 }}>
                      <AlertCircle size={20} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                      {error?.message || "Failed to load users."}
                    </div>
                    <button type="button" className="admin-btn-secondary" onClick={() => refetch()}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {debouncedSearch
                      ? `No users found matching "${debouncedSearch}".`
                      : "No users registered yet."}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u._id}
                    onClick={() => navigate(`/admin/users/${u._id}`)}
                    className="admin-clickable-row"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        navigate(`/admin/users/${u._id}`);
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
                      <span className={`admin-role-pill ${u.role === "admin" ? "admin" : "user"}`}>
                        {u.role === "admin" && <ShieldCheck size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <div className="admin-posts-count-cell">
                        <FileText size={15} color="#64748b" />
                        <span>{u.postsCount ?? 0}</span>
                      </div>
                    </td>
                    <td className="admin-table-date">{formatDate(u.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="admin-pagination-bar">
            <span className="admin-pagination-info">
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, pagination.total)} of {pagination.total} users
            </span>

            <div className="admin-pagination-actions">
              <button
                type="button"
                className="admin-pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span className="admin-pagination-current">
                Page {page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="admin-pagination-btn"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
