import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { PageHeader, ErrorBox, mutationRequest } from "./AdminShared";

export default function AdminSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminSettings(),
    queryFn: () => apiQuery("/admin/settings"),
  });

  const update = useMutation({
    mutationFn: (body) => mutationRequest(apiFetch, "/admin/settings", { method: "PATCH", body }),
    onSuccess: (r) => {
      toast.success(r.message || "Settings saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings() });
    },
    onError: (e) => toast.error(e.message),
  });

  const settings = data?.settings || {};
  const defs = data?.definitions || {};
  const system = data?.system;

  return (
    <div className="admin-page-container">
      <PageHeader title="Settings" subtitle="Platform-wide controls. Only Super Admins can change these." />
      {isError ? (
        <ErrorBox title="Unable to load settings" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="skeleton-line" style={{ height: 80 }} />
      ) : (
        <>
          <section className="ax-panel" style={{ marginBottom: 20 }}>
            <h2>Platform</h2>
            {Object.entries(defs).map(([key, def]) => (
              <label key={key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0" }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key])}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ [key]: e.target.checked })}
                />
                <span>
                  <strong>{key === "registrationOpen" ? "Open registration" : key}</strong>
                  <span className="ax-muted" style={{ display: "block" }}>
                    {def.description}
                  </span>
                </span>
              </label>
            ))}
          </section>
          {system && (
            <section className="ax-panel">
              <h2>System</h2>
              <p className="ax-muted">
                Environment: {system.environment} · Staff: {system.staff.superadmins} super admin(s), {system.staff.admins} admin(s), {system.staff.moderators} moderator(s) ·
                Atomic multi-step actions: {system.transactionsSupported ? "enabled" : "not available on this database"}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
