import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flame, Clock, MessageCircle, Eye, RefreshCw, FileText } from "lucide-react";
import { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { mediaUrl } from "../../utils/media";
import "./FeedSidebar.css";

// Relative time formatting: "2m ago", "3h ago", "2d ago", etc.
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "";
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Compact number formatting (e.g. 1.2k)
const formatCompactNum = (num) => {
  if (!num || num <= 0) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
};

const SidebarSkeletonList = () => (
  <div className="sidebar-skeleton-group" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, idx) => (
      <div key={idx} className="sidebar-item-skeleton">
        <div className="sidebar-thumb-skeleton shimmer-box" />
        <div className="sidebar-text-skeleton">
          <div className="shimmer-box shimmer-line title-line-1" />
          <div className="shimmer-box shimmer-line title-line-2" />
          <div className="shimmer-box shimmer-line meta-line" />
        </div>
      </div>
    ))}
  </div>
);

const SidebarItem = React.memo(({ post, rank }) => {
  const thumbSrc = post.coverImage || post.videoThumbnail;

  return (
    <li className="sidebar-item">
      <Link
        to={`/post/${post._id}`}
        className="sidebar-item-link"
        aria-label={`${post.title} by ${post.author?.fullName || post.author?.username || "author"}`}
      >
        <div className="sidebar-item-thumb-wrapper">
          {thumbSrc ? (
            <img
              src={mediaUrl(thumbSrc, { w: 96, h: 96, fit: "fill" })}
              alt=""
              loading="lazy"
              className="sidebar-item-thumb"
            />
          ) : (
            <div className="sidebar-item-thumb-fallback">
              <FileText size={18} />
            </div>
          )}
          {typeof rank === "number" && (
            <span className="sidebar-item-rank-badge">{rank}</span>
          )}
        </div>

        <div className="sidebar-item-content">
          <h4 className="sidebar-item-title" title={post.title}>
            {post.title}
          </h4>

          <div className="sidebar-item-meta">
            <span className="sidebar-item-author">
              @{post.author?.username || "author"}
            </span>
            <span className="sidebar-meta-dot">&bull;</span>
            <span className="sidebar-item-time">{formatRelativeTime(post.createdAt)}</span>
          </div>

          <div className="sidebar-item-metrics">
            <span className="sidebar-metric" title={`${post.commentsCount ?? 0} comments`}>
              <MessageCircle size={12} className="sidebar-metric-icon" />
              <span>{formatCompactNum(post.commentsCount)}</span>
            </span>

            <span className="sidebar-metric" title={`${post.views ?? 0} views`}>
              <Eye size={12} className="sidebar-metric-icon" />
              <span>{formatCompactNum(post.views)}</span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
});

export default function FeedSidebar() {
  const {
    data: sidebarData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.sidebarPosts(),
    queryFn: () => apiQuery("/posts/sidebar"),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const trending = useMemo(() => sidebarData?.data?.trending || [], [sidebarData]);
  const recent = useMemo(() => sidebarData?.data?.recent || [], [sidebarData]);

  return (
    <aside className="feed-right-sidebar" aria-label="Featured and latest posts">
      {/* 1. TRENDING CARD */}
      <section className="sidebar-card" aria-labelledby="sidebar-trending-heading">
        <header className="sidebar-card-header">
          <div className="sidebar-header-title-wrap">
            <div className="sidebar-header-icon-wrap trending">
              <Flame size={16} />
            </div>
            <h3 id="sidebar-trending-heading" className="sidebar-card-title">
              Trending
            </h3>
          </div>
          <span className="sidebar-header-badge">Last 7 days</span>
        </header>

        <div className="sidebar-card-body">
          {isLoading && <SidebarSkeletonList />}

          {isError && (
            <div className="sidebar-error-state">
              <p className="sidebar-error-text">Failed to load trending</p>
              <button
                type="button"
                className="sidebar-retry-btn"
                onClick={() => refetch()}
                aria-label="Retry loading trending stories"
              >
                <RefreshCw size={13} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!isLoading && !isError && trending.length === 0 && (
            <div className="sidebar-empty-state">
              <p>No trending stories right now.</p>
            </div>
          )}

          {!isLoading && !isError && trending.length > 0 && (
            <ol className="sidebar-items-list">
              {trending.map((post, idx) => (
                <SidebarItem key={post._id} post={post} rank={idx + 1} />
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* 2. MOST RECENT CARD */}
      <section className="sidebar-card" aria-labelledby="sidebar-recent-heading">
        <header className="sidebar-card-header">
          <div className="sidebar-header-title-wrap">
            <div className="sidebar-header-icon-wrap recent">
              <Clock size={16} />
            </div>
            <h3 id="sidebar-recent-heading" className="sidebar-card-title">
              Most Recent
            </h3>
          </div>
          <span className="sidebar-header-badge">Latest</span>
        </header>

        <div className="sidebar-card-body">
          {isLoading && <SidebarSkeletonList />}

          {isError && (
            <div className="sidebar-error-state">
              <p className="sidebar-error-text">Failed to load recent</p>
              <button
                type="button"
                className="sidebar-retry-btn"
                onClick={() => refetch()}
                aria-label="Retry loading recent stories"
              >
                <RefreshCw size={13} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!isLoading && !isError && recent.length === 0 && (
            <div className="sidebar-empty-state">
              <p>No recent stories right now.</p>
            </div>
          )}

          {!isLoading && !isError && recent.length > 0 && (
            <ul className="sidebar-items-list">
              {recent.map((post) => (
                <SidebarItem key={post._id} post={post} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  );
}
