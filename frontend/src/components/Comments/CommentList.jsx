import React, { useState, useMemo } from "react";
import { MessageSquare, ChevronDown, Check } from "lucide-react";
import CommentItem from "./CommentItem";
import "./Comments.css";

// Helper to build arbitrary depth comment tree from flat array
const buildCommentTree = (comments = [], sortBy = "best") => {
  const nodeMap = new Map();
  const roots = [];

  // Step 1: Create a clone of each comment with empty children
  comments.forEach((c) => {
    nodeMap.set(c._id.toString(), {
      ...c,
      children: [],
    });
  });

  // Step 2: Assemble parent-child tree
  comments.forEach((c) => {
    const node = nodeMap.get(c._id.toString());
    const parentId = c.parentComment
      ? (typeof c.parentComment === "object" ? c.parentComment._id : c.parentComment).toString()
      : null;

    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Step 3: Sort children chronologically (oldest first for Reddit conversational flow)
  nodeMap.forEach((node) => {
    if (node.children.length > 1) {
      node.children.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
  });

  // Step 4: Sort roots based on selected sort
  roots.sort((a, b) => {
    if (sortBy === "new") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === "old") {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    // "best" is default (likes count desc, then date desc)
    const aLikes = a.likesCount || 0;
    const bLikes = b.likesCount || 0;
    if (bLikes !== aLikes) {
      return bLikes - aLikes;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return roots;
};

export default function CommentList({
  comments = [],
  postId,
  postAuthorId,
  loading = false,
  sortBy = "best",
  onSortChange,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleTopLevelCount, setVisibleTopLevelCount] = useState(20);

  // Build tree
  const roots = useMemo(() => {
    return buildCommentTree(comments, sortBy);
  }, [comments, sortBy]);

  const sortOptions = [
    { key: "best", label: "Best" },
    { key: "new", label: "New" },
    { key: "old", label: "Old" },
  ];

  const currentSortLabel = sortOptions.find((o) => o.key === sortBy)?.label || "Best";

  const handleSelectSort = (key) => {
    setSortOpen(false);
    if (onSortChange) {
      onSortChange(key);
    }
  };

  const visibleRoots = roots.slice(0, visibleTopLevelCount);
  const hasMore = roots.length > visibleTopLevelCount;

  return (
    <div className="reddit-comments-container">
      {/* Header Row: N Comments & Sort Dropdown */}
      <div className="reddit-comments-header">
        <h3 className="reddit-comments-title">
          <span>Comments</span>
          <span className="reddit-comments-count-pill">{comments.length}</span>
        </h3>

        {comments.length > 0 && (
          <div className="reddit-sort-wrapper">
            <span className="reddit-sort-label">Sort by:</span>
            <button
              type="button"
              className="reddit-sort-btn"
              onClick={() => setSortOpen((v) => !v)}
              aria-label={`Sort comments by ${currentSortLabel}`}
            >
              <span>{currentSortLabel}</span>
              <ChevronDown size={14} />
            </button>

            {sortOpen && (
              <div className="reddit-sort-menu">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`reddit-sort-item ${sortBy === opt.key ? "active" : ""}`}
                    onClick={() => handleSelectSort(opt.key)}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.key && <Check size={14} color="#e8590c" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && comments.length === 0 && (
        <div className="reddit-comments-skeleton-list">
          {[1, 2, 3].map((n) => (
            <div key={n} className="reddit-comment-skeleton">
              <div className="reddit-skeleton-avatar" />
              <div className="reddit-skeleton-content">
                <div className="reddit-skeleton-line-sm" />
                <div className="reddit-skeleton-line-lg" />
                <div className="reddit-skeleton-line-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && comments.length === 0 && (
        <div className="reddit-comments-empty">
          <div className="reddit-empty-icon-wrap">
            <MessageSquare size={24} />
          </div>
          <p className="reddit-empty-text">
            No comments yet. Be the first to share your thoughts.
          </p>
        </div>
      )}

      {/* Comment Tree */}
      {visibleRoots.length > 0 && (
        <div className="reddit-comment-tree">
          {visibleRoots.map((rootComment) => (
            <CommentItem
              key={rootComment._id}
              comment={rootComment}
              postId={postId}
              postAuthorId={postAuthorId}
              depth={0}
              onCommentAdded={onCommentAdded}
              onCommentUpdated={onCommentUpdated}
              onCommentDeleted={onCommentDeleted}
            />
          ))}

          {/* Load More Top-Level Comments */}
          {hasMore && (
            <button
              type="button"
              className="reddit-view-more-replies-btn"
              style={{ marginTop: 16, alignSelf: "center" }}
              onClick={() => setVisibleTopLevelCount((prev) => prev + 20)}
            >
              <span>Load more comments ({roots.length - visibleTopLevelCount} remaining)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
