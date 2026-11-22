import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys } from "../../api/queryClient";
import { PageHeader, TableState, ErrorBox, mutationRequest, formatDate } from "./AdminShared";
import ConfirmDialog from "../../components/ConfirmDialog";

function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const save = useMutation({
    mutationFn: () =>
      mutationRequest(apiFetch, category ? `/categories/${category._id}` : "/categories", {
        method: category ? "PUT" : "POST",
        body: { name: name.trim(), description: description.trim() },
      }),
    onSuccess: () => {
      toast.success(category ? "Category updated" : "Category created");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="ax-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="ax-modal"
        style={{ width: "min(480px, 100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label={category ? "Edit category" : "New category"}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <div className="ax-modal-head">
          <h2>{category ? "Edit category" : "New category"}</h2>
          <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="ax-field">
          <span className="ax-field-label">Name</span>
          <input className="ax-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus />
        </label>
        <label className="ax-field">
          <span className="ax-field-label">Description (optional)</span>
          <textarea className="ax-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </label>
        <div className="ax-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="ax-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ax-btn ax-btn-primary" disabled={!name.trim() || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteCategory({ category, others, onClose, onDone }) {
  const toast = useToast();
  const inUse = category.postsCount > 0;
  const [target, setTarget] = useState(inUse ? "" : "none");
  const del = useMutation({
    mutationFn: () => mutationRequest(apiFetch, `/categories/${category._id}${inUse ? `?reassignTo=${target}` : ""}`, { method: "DELETE" }),
    onSuccess: (r) => {
      toast.success(r.message || "Category deleted");
      onDone();
    },
    onError: (e) => {
      toast.error(e.message);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      isOpen
      title={`Delete "${category.name}"?`}
      message={inUse ? `${category.postsCount} post${category.postsCount === 1 ? " uses" : "s use"} this category. Choose where they should go.` : "No posts use this category."}
      confirmText="Delete category"
      loading={del.isPending}
      confirmDisabled={!target}
      onConfirm={() => del.mutate()}
      onClose={onClose}
    >
      {inUse && (
        <label className="ax-field">
          <span className="ax-field-label">Move posts to</span>
          <select className="ax-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select…</option>
            <option value="none">No category</option>
            {others.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </ConfirmDialog>
  );
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null); // {} for new, category for edit
  const [removing, setRemoving] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminCategories(),
    queryFn: () => apiQuery("/categories?withCounts=true"),
    staleTime: 30 * 1000,
  });
  const categories = Array.isArray(data) ? data : [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories() });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
    queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
  };

  return (
    <div className="admin-page-container">
      <PageHeader
        title="Categories"
        subtitle="Organise posts into categories"
        actions={
          <button type="button" className="ax-btn ax-btn-primary" onClick={() => setForm({})}>
            <Plus size={15} /> New category
          </button>
        }
      />
      {isError && !data ? (
        <ErrorBox title="Unable to load categories" error={error} onRetry={refetch} />
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Posts</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <TableState isLoading={isLoading} isError={false} isEmpty={categories.length === 0} emptyText="No categories yet. Create the first one." colSpan={5}>
                  {categories.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <strong>{c.name}</strong>
                        <span className="ax-muted"> /{c.slug}</span>
                      </td>
                      <td>
                        <span className="ax-cell-text ax-cell-wrap">{c.description || "—"}</span>
                      </td>
                      <td>{c.postsCount ?? 0}</td>
                      <td className="admin-table-date">{formatDate(c.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="ax-row-actions">
                          <button type="button" className="admin-post-action-btn" onClick={() => setForm(c)}>
                            <Pencil size={15} />
                            <span>Edit</span>
                          </button>
                          <button type="button" className="admin-post-action-btn delete" onClick={() => setRemoving(c)}>
                            <Trash2 size={15} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </TableState>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {form && (
        <CategoryForm
          category={form._id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
      {removing && (
        <DeleteCategory
          category={removing}
          others={categories.filter((c) => c._id !== removing._id)}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
