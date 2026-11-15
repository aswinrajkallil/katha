import React from "react";
import { Sparkles, Video, X } from "lucide-react";
import "./SortBar.css";

export const buildFeedQueryUrl = (basePath, { page = 1, limit = 10, sort = "latest", hasVideo = false, authorId = null }) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sort", sort);
  if (hasVideo) params.set("hasVideo", "true");
  if (authorId) params.set("author", String(authorId));
  return `${basePath}?${params.toString()}`;
};

export default function SortBar({
  sort = "latest",
  onSortChange,
  hasVideo = false,
  onHasVideoToggle,
  selectedAuthor = null,
  onClearAuthor,
  className = "",
}) {
  const isLatest = sort === "latest";
  const isMostViewed = sort === "mostViewed" || sort === "views";
  const isMostCommented = sort === "mostCommented" || sort === "comments";

  return (
    <div className={`shared-sort-bar ${className}`.trim()} role="toolbar" aria-label="Sort and filter stories">
      <div className="shared-sort-group">
        <button
          type="button"
          className={`shared-pill-btn ${isLatest ? "active" : ""}`}
          onClick={() => onSortChange && onSortChange("latest")}
          aria-pressed={isLatest}
        >
          <Sparkles size={14} />
          <span>Latest</span>
        </button>

        <button
          type="button"
          className={`shared-pill-btn ${isMostViewed ? "active" : ""}`}
          onClick={() => onSortChange && onSortChange("mostViewed")}
          aria-pressed={isMostViewed}
        >
          <span>Most viewed</span>
        </button>

        <button
          type="button"
          className={`shared-pill-btn ${isMostCommented ? "active" : ""}`}
          onClick={() => onSortChange && onSortChange("mostCommented")}
          aria-pressed={isMostCommented}
        >
          <span>Most commented</span>
        </button>
      </div>

      <div className="shared-filter-group">
        {/* Active Author Filter Badge */}
        {selectedAuthor && (
          <span className="shared-author-chip">
            <span>@{selectedAuthor.username}</span>
            <button
              type="button"
              className="shared-author-clear-btn"
              onClick={() => onClearAuthor && onClearAuthor()}
              aria-label={`Clear filter by @${selectedAuthor.username}`}
            >
              <X size={13} />
            </button>
          </span>
        )}

        {/* Has Video Toggle */}
        <button
          type="button"
          className={`shared-filter-toggle ${hasVideo ? "active" : ""}`}
          onClick={() => onHasVideoToggle && onHasVideoToggle()}
          aria-pressed={hasVideo}
        >
          <Video size={15} />
          <span>Has video</span>
        </button>
      </div>
    </div>
  );
}
