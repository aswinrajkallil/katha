import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Eye, FileText, ChevronRight } from "lucide-react";
import { apiQuery } from "../../api/api";
import useFollowToggle from "../../hooks/useFollowToggle";
import { queryKeys } from "../../api/queryClient";
import { useAuth } from "../../context/AuthContext";
import { mediaUrl } from "../../utils/media";
import UserAvatar from "../UserAvatar";
import "./FeedSidebar.css";

// "2m ago", "3h ago", "2d ago" ...
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// 1200 -> 1.2k
const formatCompact = (num) => {
  if (!num || num <= 0) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------------------------------------------------------------
   Post row: the title link is stretched over the whole row, and the
   three stats sit above it as their own links (no nested anchors).
---------------------------------------------------------------- */
const PostRow = React.memo(function PostRow({ post, rank }) {
  const thumbSrc = post.coverImage || post.videoThumbnail;
  const postPath = `/post/${post._id}`;

  return (
    <li className="fs-row">
      <div className="fs-thumb">
        {thumbSrc ? (
          <img src={mediaUrl(thumbSrc, { w: 112, h: 112, fit: "fill" })} alt="" loading="lazy" />
        ) : (
          <span className="fs-thumb-fallback" aria-hidden="true">
            <FileText size={18} />
          </span>
        )}
        {typeof rank === "number" && <span className="fs-rank">{rank}</span>}
      </div>

      <div className="fs-body">
        <h4 className="fs-title">
          <Link to={postPath} className="fs-title-link" title={post.title}>
            {post.title}
          </Link>
        </h4>

        <div className="fs-meta">
          <span>@{post.author?.username || "author"}</span>
          <span aria-hidden="true">&bull;</span>
          <span>{formatRelativeTime(post.createdAt)}</span>
        </div>

        <div className="fs-stats">
          <Link to={postPath} className="fs-stat" aria-label={plural(post.likesCount ?? 0, "like")} title="Likes">
            <Heart size={13} />
            <span>{formatCompact(post.likesCount)}</span>
          </Link>
          <Link
            to={`${postPath}#comments`}
            className="fs-stat"
            aria-label={plural(post.commentsCount ?? 0, "comment")}
            title="Comments"
          >
            <MessageCircle size={13} />
            <span>{formatCompact(post.commentsCount)}</span>
          </Link>
          <Link to={postPath} className="fs-stat" aria-label={plural(post.views ?? 0, "view")} title="Views">
            <Eye size={13} />
            <span>{formatCompact(post.views)}</span>
          </Link>
        </div>
      </div>
    </li>
  );
});

/* ---------------------------------------------------------------
   Author row with a Follow / Unfollow toggle (logged-in users only)
---------------------------------------------------------------- */
const AuthorRow = React.memo(function AuthorRow({ author }) {
  const { user } = useAuth();
  const { follow, isPending } = useFollowToggle();
  // Authors in this list are people you do not follow yet, unless the API says otherwise
  const [following, setFollowing] = useState(Boolean(author.isFollowing));
  const busy = isPending(author._id);

  const displayName = author.fullName || author.username;
  const profilePath = `/profile/${author.username}`;

  const handleToggle = async () => {
    if (busy) return;
    const next = !following;
    setFollowing(next); // optimistic
    const result = await follow(author, next);
    if (!result) setFollowing(!next); // roll back on failure
  };

  return (
    <li className="fs-row fs-author-row">
      <Link to={profilePath} className="fs-author-avatar" aria-label={`View ${displayName}'s profile`}>
        <UserAvatar user={author} size={40} />
      </Link>

      <div className="fs-body">
        <h4 className="fs-title fs-author-name">
          <Link to={profilePath} className="fs-title-link">
            {displayName}
          </Link>
        </h4>
        <div className="fs-meta">
          <span>@{author.username}</span>
        </div>
        <div className="fs-meta">
          <span>{plural(author.postCount ?? 0, "post")}</span>
          <span aria-hidden="true">&bull;</span>
          <span>{plural(author.followersCount ?? 0, "follower")}</span>
        </div>
      </div>

      {user && (
        <button
          type="button"
          className={`fs-follow-btn ${following ? "is-following" : ""}`}
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={following}
          aria-label={following ? `Unfollow @${author.username}` : `Follow @${author.username}`}
        >
          {following ? (
            <>
              <span className="fs-follow-label-default">Following</span>
              <span className="fs-follow-label-hover">Unfollow</span>
            </>
          ) : (
            "Follow"
          )}
        </button>
      )}
    </li>
  );
});

const SectionCard = ({ section }) => {
  const headingId = `fs-heading-${section.key}`;
  const isPosts = section.kind === "posts";

  return (
    <section className="fs-card" aria-labelledby={headingId}>
      <header className="fs-card-header">
        <h3 id={headingId} className="fs-card-title">
          {section.title}
        </h3>
        {section.href ? (
          <Link to={section.href} className="fs-card-link">
            See all <ChevronRight size={14} />
          </Link>
        ) : (
          section.badge && <span className="fs-card-badge">{section.badge}</span>
        )}
      </header>

      <ul className="fs-list">
        {isPosts
          ? section.items.map((post, idx) => (
              <PostRow key={post._id} post={post} rank={section.ranked ? idx + 1 : undefined} />
            ))
          : section.items.map((author) => <AuthorRow key={author._id} author={author} />)}
      </ul>
    </section>
  );
};

const SkeletonCard = () => (
  <div className="fs-card" aria-hidden="true">
    <div className="fs-card-header">
      <div className="fs-skel fs-skel-heading" />
    </div>
    <div className="fs-list">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="fs-row">
          <div className="fs-skel fs-skel-thumb" />
          <div className="fs-body">
            <div className="fs-skel fs-skel-line" />
            <div className="fs-skel fs-skel-line short" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function FeedSidebar() {
  const { user } = useAuth();
  const userKey = user?._id || user?.id || "guest";

  const { data, isLoading, isError, refetch } = useQuery({
    // userKey in the key so logging in/out never shows the other user's sidebar
    queryKey: [...queryKeys.sidebarPosts(), userKey],
    queryFn: () => apiQuery("/posts/sidebar"),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // apiQuery already unwraps `data`, so the payload is { sections } (not data.sections)
  const sections = data?.sections ?? [];

  if (isLoading) {
    return (
      <aside className="feed-right-sidebar" aria-busy="true" aria-label="Loading sidebar">
        <SkeletonCard />
        <SkeletonCard />
      </aside>
    );
  }

  if (isError) {
    return (
      <aside className="feed-right-sidebar" aria-label="Sidebar">
        <p className="fs-error">
          Couldn&apos;t load this section.{" "}
          <button type="button" className="fs-error-retry" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      </aside>
    );
  }

  // Nothing to show at all: render nothing, never an empty card
  if (sections.length === 0) return null;

  return (
    <aside className="feed-right-sidebar" aria-label="Trending, creators and latest stories">
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} />
      ))}
    </aside>
  );
}
