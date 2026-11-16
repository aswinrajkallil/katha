import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FileCheck2,
  FileEdit,
  MessageCircle,
  Heart,
  UserPlus,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import "./AdminDashboard.css";

const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString();
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

export default function AdminDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminStats(),
    queryFn: () => apiQuery("/admin/stats"),
    staleTime: 30 * 1000,
  });

  const totals = data?.totals || {};
  const recentActivity = data?.recentActivity || {};
  const recentSignups = data?.recentSignups || [];

  if (isLoading) {
    return (
      <div className="admin-page-container">
        <div className="admin-page-header">
          <div className="admin-header-title-wrap">
            <h1 className="admin-page-title">Dashboard</h1>
            <p className="admin-page-subtitle">Overview of platform metrics and recent growth</p>
          </div>
        </div>

        {/* Skeleton Grid */}
        <div className="admin-stats-grid">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="admin-stat-card skeleton-card">
              <div className="skeleton-line title" />
              <div className="skeleton-line value" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-page-container">
        <div className="admin-error-box">
          <AlertCircle size={32} color="#dc2626" />
          <h2>Unable to Load Admin Statistics</h2>
          <p>{error?.message || "An error occurred while connecting to the admin service."}</p>
          <button type="button" className="admin-btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div className="admin-header-title-wrap">
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Overview of platform metrics and user activity</p>
        </div>
        <button type="button" className="admin-btn-refresh" onClick={() => refetch()} title="Refresh stats">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary Stat Cards Grid */}
      <section className="admin-stats-grid" aria-label="Key platform metrics">
        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap users">
            <Users size={22} />
          </div>
          <div className="admin-stat-body">
            <span className="admin-stat-label">Total Users</span>
            <span className="admin-stat-value">{formatNumber(totals.users)}</span>
            <span className="admin-stat-sub">
              <UserPlus size={13} />
              +{formatNumber(recentActivity.signupsLast7Days)} in last 7 days
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap published">
            <FileCheck2 size={22} />
          </div>
          <div className="admin-stat-body">
            <span className="admin-stat-label">Published Posts</span>
            <span className="admin-stat-value">{formatNumber(totals.publishedPosts)}</span>
            <span className="admin-stat-sub">
              <TrendingUp size={13} />
              +{formatNumber(recentActivity.postsLast7Days)} in last 7 days
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap drafts">
            <FileEdit size={22} />
          </div>
          <div className="admin-stat-body">
            <span className="admin-stat-label">Draft Posts</span>
            <span className="admin-stat-value">{formatNumber(totals.draftPosts)}</span>
            <span className="admin-stat-sub">Unpublished drafts</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap comments">
            <MessageCircle size={22} />
          </div>
          <div className="admin-stat-body">
            <span className="admin-stat-label">Comments</span>
            <span className="admin-stat-value">{formatNumber(totals.comments)}</span>
            <span className="admin-stat-sub">Active thread discussions</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap likes">
            <Heart size={22} />
          </div>
          <div className="admin-stat-body">
            <span className="admin-stat-label">Total Likes</span>
            <span className="admin-stat-value">{formatNumber(totals.likes)}</span>
            <span className="admin-stat-sub">Community engagement</span>
          </div>
        </div>
      </section>

      {/* Recent Signups Section */}
      <section className="admin-dashboard-section" aria-label="Recent platform signups">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Recent Signups</h2>
          <Link to="/admin/users" className="admin-section-link">
            <span>View all users</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      No recent signups found.
                    </td>
                  </tr>
                ) : (
                  recentSignups.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div className="admin-table-user-cell">
                          <UserAvatar user={u} size={32} />
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
                      <td className="admin-table-date">{formatDate(u.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link to={`/admin/users/${u._id}`} className="admin-table-action-link">
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
