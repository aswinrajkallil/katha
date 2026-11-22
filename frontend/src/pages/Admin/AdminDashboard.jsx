import React, { useState } from "react";
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
  Flag,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import UserAvatar from "../../components/UserAvatar";
import { LineChart } from "./AdminCharts";
import {
  RangePicker,
  rangeToQuery,
  rangeIsValid,
  RoleBadge,
  PageHeader,
  ErrorBox,
  formatDate,
  formatNumber,
  humanize,
} from "./AdminShared";
import "./AdminDashboard.css";

const RANGE_LABEL = { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", custom: "selected range" };

export default function AdminDashboard() {
  const [range, setRange] = useState({ range: "7d", from: "", to: "" });
  const valid = rangeIsValid(range);
  const rangeKey = rangeToQuery(range);

  const stats = useQuery({
    queryKey: queryKeys.adminStats(rangeKey),
    queryFn: () => apiQuery(`/admin/stats?${rangeKey}`),
    staleTime: 30 * 1000,
    enabled: valid,
    placeholderData: (prev) => prev,
  });
  const trends = useQuery({
    queryKey: queryKeys.adminTrends({ rangeKey }),
    queryFn: () => apiQuery(`/admin/trends?${rangeKey}`),
    staleTime: 60 * 1000,
    enabled: valid,
    placeholderData: (prev) => prev,
  });

  const data = stats.data;
  const totals = data?.totals || {};
  const reports = data?.reports || {};
  const activity = data?.recentActivity || {};
  const recentSignups = data?.recentSignups || [];
  const recentModeration = data?.recentModeration || [];
  const label = RANGE_LABEL[range.range];

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="Overview of platform metrics and user activity"
      actions={
        <button
          type="button"
          className="admin-btn-refresh"
          onClick={() => {
            stats.refetch();
            trends.refetch();
          }}
          title="Refresh stats"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      }
    />
  );

  if (stats.isError && !data) {
    return (
      <div className="admin-page-container">
        {header}
        <ErrorBox title="Unable to load admin statistics" error={stats.error} onRetry={() => stats.refetch()} />
      </div>
    );
  }

  const loading = stats.isLoading && !data;

  const card = (icon, tone, title, value, sub) => (
    <div className="admin-stat-card">
      <div className={`admin-stat-icon-wrap ${tone}`}>{icon}</div>
      <div className="admin-stat-body">
        <span className="admin-stat-label">{title}</span>
        <span className="admin-stat-value">{loading ? "…" : formatNumber(value)}</span>
        <span className="admin-stat-sub">{sub}</span>
      </div>
    </div>
  );

  return (
    <div className="admin-page-container">
      {header}

      <div style={{ marginBottom: 18 }}>
        <RangePicker value={range} onChange={setRange} />
        {!valid && <p className="ax-muted">Choose a start date that is on or before the end date.</p>}
      </div>

      <section className="admin-stats-grid" aria-label="Key platform metrics" aria-busy={loading}>
        {card(<Users size={22} />, "users", "Total Users", totals.users, (
          <>
            <UserPlus size={13} /> +{formatNumber(activity.signupsInRange)} in {label}
          </>
        ))}
        {card(<Users size={22} />, "users", "Active Users", totals.activeUsers, `${formatNumber(totals.deletedUsers)} deactivated`)}
        {card(<FileCheck2 size={22} />, "published", "Published Posts", totals.publishedPosts, (
          <>
            <TrendingUp size={13} /> +{formatNumber(activity.postsInRange)} in {label}
          </>
        ))}
        {card(<FileEdit size={22} />, "drafts", "Draft Posts", totals.draftPosts, "Unpublished drafts")}
        {card(<Trash2 size={22} />, "likes", "Removed Posts", totals.deletedPosts, "Soft-deleted, restorable")}
        {card(<MessageCircle size={22} />, "comments", "Comments", totals.comments, "Visible comments")}
        {card(<Heart size={22} />, "likes", "Total Likes", totals.likes, "Community engagement")}
        {card(<ShieldCheck size={22} />, "users", "Staff", (totals.superadmins || 0) + (totals.admins || 0) + (totals.moderators || 0), `${formatNumber(totals.superadmins)} super · ${formatNumber(totals.admins)} admin · ${formatNumber(totals.moderators)} mod`)}
      </section>

      <section className="admin-dashboard-section" aria-label="Reports summary">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Reports</h2>
          <Link to="/admin/reports" className="admin-section-link">
            <span>Open queue</span>
            <ArrowRight size={16} />
          </Link>
        </div>
        <section className="admin-stats-grid">
          {card(<Flag size={22} />, "likes", "Pending", reports.pending, "Awaiting review")}
          {card(<Flag size={22} />, "users", "Under Review", reports.underReview, "Assigned to staff")}
          {card(<Flag size={22} />, "published", "Resolved", reports.resolved, "Action taken")}
          {card(<Flag size={22} />, "drafts", "Dismissed", reports.dismissed, "No violation found")}
        </section>
      </section>

      <section className="admin-dashboard-section" aria-label="Trends">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Trends</h2>
          <Link to="/admin/analytics" className="admin-section-link">
            <span>Full analytics</span>
            <ArrowRight size={16} />
          </Link>
        </div>
        {trends.isError ? (
          <ErrorBox title="Unable to load trends" error={trends.error} onRetry={() => trends.refetch()} />
        ) : (
          <div className="ax-panel-grid" aria-busy={trends.isLoading}>
            <div className="ax-panel">
              <LineChart title="New registrations" subtitle="Per day" points={trends.data?.registrations || []} series={[{ key: "count", label: "Registrations" }]} />
            </div>
            <div className="ax-panel">
              <LineChart title="Posts published" subtitle="Per day" points={trends.data?.posts || []} series={[{ key: "count", label: "Posts" }]} />
            </div>
            <div className="ax-panel">
              <LineChart
                title="Engagement"
                subtitle="Likes and comments per day"
                points={trends.data?.engagement || []}
                series={[
                  { key: "likes", label: "Likes" },
                  { key: "comments", label: "Comments" },
                ]}
              />
            </div>
            <div className="ax-panel">
              <LineChart title="Moderation actions" subtitle="Per day" points={trends.data?.moderation || []} series={[{ key: "count", label: "Actions" }]} />
            </div>
          </div>
        )}
      </section>

      <section className="admin-dashboard-section" aria-label="Recent signups">
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
                      {loading ? "Loading…" : "No recent signups found."}
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
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="admin-table-date">{formatDate(u.createdAt, true)}</td>
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

      <section className="admin-dashboard-section" aria-label="Recent moderation activity">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Recent Moderation Activity</h2>
          <Link to="/admin/activity" className="admin-section-link">
            <span>Activity log</span>
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {recentModeration.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      {loading ? "Loading…" : "No moderation activity yet."}
                    </td>
                  </tr>
                ) : (
                  recentModeration.map((log) => (
                    <tr key={log._id}>
                      <td className="admin-table-date">{formatDate(log.createdAt, true)}</td>
                      <td>
                        {log.actorUsername ? `@${log.actorUsername}` : "System"} <RoleBadge role={log.actorRole === "system" ? "user" : log.actorRole} />
                      </td>
                      <td>{humanize(log.action)}</td>
                      <td>
                        <span className="ax-cell-text">{log.targetLabel || log.targetType}</span>
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
