import React from "react";
import { useNavigate } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import "./AuthorStripItem.css";

const formatFollowerCount = (count) => {
  const n = count || 0;
  return `${n} ${n === 1 ? "follower" : "followers"}`;
};

const formatStoryCount = (count) => {
  const n = count || 0;
  return `${n} ${n === 1 ? "story" : "stories"}`;
};

export default function AuthorStripItem({
  author,
  hasNewPost = false,
  isSelected = false,
  showStats = false,
  showFollowButton = false,
  onFollowToggle,
  onClick,
  followLoading = false,
}) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (author?.username) {
      navigate(`/profile/${author.username}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <div className={`author-strip-item ${isSelected ? "selected" : ""}`}>
      {/* Clickable Avatar + Name */}
      <div
        className="author-strip-clickable"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        title={author?.username ? `View @${author.username}'s profile` : "Author profile"}
      >
        <div
          className={`author-strip-avatar-wrap ${hasNewPost ? "has-new" : ""} ${
            isSelected ? "active-filter" : ""
          }`}
        >
          <UserAvatar user={author} size={48} />
          {hasNewPost && <span className="author-strip-new-dot" />}
        </div>

        <span className="author-strip-username">@{author?.username || "author"}</span>
      </div>

      {/* Optional Stats line: stories & follower count with singular/plural support */}
      {showStats && (
        <span className="author-strip-stats">
          {formatStoryCount(author?.postCount)} • {formatFollowerCount(author?.followersCount)}
        </span>
      )}

      {/* Optional Compact Follow / Following Pill */}
      {showFollowButton && !author?.isSelf && (
        <button
          type="button"
          className={`author-strip-follow-pill ${author?.isFollowing ? "following" : "follow"}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onFollowToggle) onFollowToggle(author);
          }}
          disabled={followLoading}
        >
          {followLoading ? "Updating…" : author?.isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}
