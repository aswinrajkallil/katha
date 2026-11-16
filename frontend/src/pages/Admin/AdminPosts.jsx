import React from "react";
import "./AdminPosts.css";

export default function AdminPosts() {
  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Posts Moderation</h1>
          <p className="admin-page-subtitle">Search, filter, and moderate user posts</p>
        </div>
      </div>
      <div className="admin-table-card" style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        Loading posts moderation table...
      </div>
    </div>
  );
}
