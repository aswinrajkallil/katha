import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { LineChart, BarList, StatTile } from "./AdminCharts";
import { PageHeader, RangePicker, rangeToQuery, rangeIsValid, ErrorBox, humanize } from "./AdminShared";

export default function AdminAnalytics() {
  const [range, setRange] = useState({ range: "30d", from: "", to: "" });
  const rangeKey = rangeToQuery(range);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminAnalytics({ rangeKey }),
    queryFn: () => apiQuery(`/admin/analytics?${rangeKey}`),
    enabled: rangeIsValid(range),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const m = data?.moderation;
  const trends = data?.trends;

  return (
    <div className="admin-page-container">
      <PageHeader title="Analytics" subtitle="Growth, content, engagement and moderation over time" />
      <div style={{ marginBottom: 18 }}>
        <RangePicker value={range} onChange={setRange} />
        {!rangeIsValid(range) && <p className="ax-muted">Choose a start date that is on or before the end date.</p>}
      </div>

      {isError && !data ? (
        <ErrorBox title="Unable to load analytics" error={error} onRetry={refetch} />
      ) : (
        <div aria-busy={isLoading}>
          <div className="ax-stat-row">
            <StatTile label="Active accounts" value={data?.accounts?.active ?? "…"} sub={`${data?.accounts?.deleted ?? 0} deactivated`} />
            <StatTile label="Published posts" value={data?.content?.published ?? "…"} sub={`${data?.content?.draft ?? 0} drafts`} />
            <StatTile label="Reports received" value={m?.reportsReceived ?? "…"} sub={`${m?.open ?? 0} still open`} />
            <StatTile label="Resolution rate" value={m?.resolutionRate == null ? "—" : `${m.resolutionRate}%`} sub={`${m?.resolved ?? 0} resolved · ${m?.dismissed ?? 0} dismissed`} />
            <StatTile label="Avg. time to close" value={m?.avgResolutionHours == null ? "—" : `${m.avgResolutionHours} h`} sub="Resolved or dismissed reports" />
          </div>

          <div className="ax-panel-grid">
            <div className="ax-panel">
              <LineChart title="User growth" subtitle="New registrations per day" points={trends?.registrations || []} series={[{ key: "count", label: "Registrations" }]} />
            </div>
            <div className="ax-panel">
              <LineChart title="Posts published" subtitle="Per day" points={trends?.posts || []} series={[{ key: "count", label: "Posts" }]} />
            </div>
            <div className="ax-panel">
              <LineChart
                title="Engagement"
                subtitle="Likes and comments per day"
                points={trends?.engagement || []}
                series={[
                  { key: "likes", label: "Likes" },
                  { key: "comments", label: "Comments" },
                ]}
              />
            </div>
            <div className="ax-panel">
              <LineChart title="Moderation actions" subtitle="Per day" points={trends?.moderation || []} series={[{ key: "count", label: "Actions" }]} />
            </div>
          </div>

          <div className="ax-panel-grid">
            <div className="ax-panel">
              <BarList
                title="Most engaging posts"
                subtitle="Likes + comments earned in this period"
                items={(data?.popularPosts || []).map((p) => ({ key: p._id, label: p.title, sub: p.author ? `@${p.author}` : undefined, value: p.likes + p.comments }))}
              />
            </div>
            <div className="ax-panel">
              <BarList
                title="Most active authors"
                subtitle="Posts published in this period"
                items={(data?.activeAuthors || []).map((a) => ({ key: a._id, label: a.fullName || a.username, sub: `@${a.username}`, value: a.posts }))}
              />
            </div>
            <div className="ax-panel">
              <BarList title="Popular categories" subtitle="Published posts, all time" items={(data?.popularCategories || []).map((c) => ({ key: c._id, label: c.name, value: c.posts }))} />
            </div>
            <div className="ax-panel">
              <BarList title="Reports by reason" subtitle="Received in this period" items={(data?.reportsByReason || []).map((r) => ({ key: r.reason, label: humanize(r.reason), value: r.count }))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
