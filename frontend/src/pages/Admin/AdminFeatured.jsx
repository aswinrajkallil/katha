import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, StarOff, Star } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { PageHeader, ErrorBox, StatusPill, mutationRequest, formatDate } from "./AdminShared";

export default function AdminFeatured() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminFeatured(),
    queryFn: () => apiQuery("/admin/featured"),
    staleTime: 15 * 1000,
  });
  const posts = data?.posts || [];

  const done = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminFeatured() });
    queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
  };

  const reorder = useMutation({
    mutationFn: (ids) => mutationRequest(apiFetch, "/admin/featured/order", { method: "PUT", body: { ids } }),
    onSuccess: done,
    onError: (e) => {
      toast.error(e.message);
      done();
    },
  });
  const unfeature = useMutation({
    mutationFn: (id) => mutationRequest(apiFetch, `/admin/posts/${id}/feature`, { method: "PATCH", body: { featured: false } }),
    onSuccess: () => {
      toast.success("Removed from featured");
      done();
    },
    onError: (e) => toast.error(e.message),
  });

  const move = (index, delta) => {
    const ids = posts.map((p) => p._id);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="admin-page-container">
      <PageHeader title="Featured Posts" subtitle="Choose which posts are highlighted, and in what order. Feature posts from the Posts page." />
      {isError ? (
        <ErrorBox title="Unable to load featured posts" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="skeleton-line" style={{ height: 80 }} />
      ) : posts.length === 0 ? (
        <div className="ax-panel" style={{ textAlign: "center" }}>
          <Star size={28} color="#94a3b8" />
          <p className="ax-muted">Nothing is featured yet.</p>
          <Link to="/admin/posts" className="ax-btn">
            Browse posts
          </Link>
        </div>
      ) : (
        <ol className="ax-history" aria-label="Featured posts in display order">
          {posts.map((p, i) => (
            <li key={p._id} className="ax-panel" style={{ borderLeft: "none", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ width: 24 }}>{i + 1}</strong>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div>{p.title}</div>
                <div className="ax-muted">
                  @{p.author?.username || "unknown"} · featured {formatDate(p.featuredAt)} {p.category?.name && `· ${p.category.name}`}
                </div>
              </div>
              {p.visible ? <StatusPill status="published" /> : <StatusPill status={p.hiddenReason === "deleted" ? "removed" : "unpublished"} />}
              {!p.visible && <span className="ax-muted">Hidden from the public site</span>}
              <div className="ax-row-actions">
                <button type="button" className="ax-btn" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label={`Move ${p.title} up`}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="ax-btn" disabled={i === posts.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label={`Move ${p.title} down`}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="ax-btn ax-btn-danger" disabled={unfeature.isPending} onClick={() => unfeature.mutate(p._id)}>
                  <StarOff size={14} /> Unfeature
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
