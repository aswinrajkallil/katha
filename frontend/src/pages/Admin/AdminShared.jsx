import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Shield,
  ShieldHalf,
  User as UserIcon,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ROLE_LABELS } from "./adminAccess";
import "./AdminShared.css";

export const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  } catch {
    return String(value);
  }
};

export const formatNumber = (n) => (n === null || n === undefined ? "0" : Number(n).toLocaleString());

export const humanize = (value) =>
  String(value || "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const ROLE_ICONS = { superadmin: ShieldCheck, admin: Shield, moderator: ShieldHalf, user: UserIcon };

export function RoleBadge({ role }) {
  const Icon = ROLE_ICONS[role] || UserIcon;
  return (
    <span className={`ax-role ax-role-${role || "user"}`}>
      <Icon size={12} aria-hidden="true" />
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export function StatusPill({ status }) {
  return <span className={`ax-pill ax-pill-${String(status).replace(/_/g, "-")}`}>{humanize(status)}</span>;
}

export function SearchInput({ value, onChange, placeholder, label }) {
  return (
    <div className="admin-search-box">
      <Search size={18} className="admin-search-icon" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
      />
      {value && (
        <button type="button" className="admin-search-clear" onClick={() => onChange("")} aria-label="Clear search">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="ax-select">
      <span className="ax-select-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="admin-posts-status-filters ax-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`admin-filter-pill ${value === t.value ? "active" : ""}`}
          onClick={() => onChange(t.value)}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="ax-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ pagination, page, onPage, noun = "items" }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { total, limit, totalPages } = pagination;
  return (
    <div className="admin-pagination-bar">
      <span className="admin-pagination-info">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} {noun}
      </span>
      <div className="admin-pagination-actions">
        <button
          type="button"
          className="admin-pagination-btn"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="admin-pagination-current">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="admin-pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/** Rows for a table body: skeleton while loading, error with retry, or an empty state. */
export function TableState({ isLoading, isError, error, onRetry, isEmpty, emptyText, colSpan, children }) {
  if (isLoading) {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <td colSpan={colSpan}>
          <div className="skeleton-line" style={{ height: 26 }} />
        </td>
      </tr>
    ));
  }
  if (isError) {
    return (
      <tr>
        <td colSpan={colSpan} className="admin-table-empty">
          <div className="ax-inline-error">
            <AlertCircle size={18} /> {error?.message || "Something went wrong."}
          </div>
          <button type="button" className="admin-btn-secondary" onClick={onRetry}>
            <RefreshCw size={14} /> Retry
          </button>
        </td>
      </tr>
    );
  }
  if (isEmpty) {
    return (
      <tr>
        <td colSpan={colSpan} className="admin-table-empty">
          {emptyText}
        </td>
      </tr>
    );
  }
  return children;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="admin-page-header">
      <div className="admin-header-title-wrap">
        <h1 className="admin-page-title">{title}</h1>
        {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ax-header-actions">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ title, error, onRetry }) {
  return (
    <div className="admin-error-box">
      <AlertCircle size={28} color="#dc2626" />
      <div className="admin-error-content">
        <h3>{title}</h3>
        <p>{error?.message || "An unexpected error occurred."}</p>
      </div>
      {onRetry && (
        <button type="button" className="admin-btn-secondary" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

/**
 * Confirmation with an optional (or required) reason. `onConfirm(reason)` is called with the trimmed text.
 */
export function ReasonDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  danger = true,
  reasonRequired = false,
  minLength = 3,
  reasonLabel = "Reason",
  loading,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  const trimmed = reason.trim();
  const invalid = reasonRequired && trimmed.length < minLength;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      message={message}
      confirmText={confirmText}
      danger={danger}
      loading={loading}
      confirmDisabled={invalid}
      onConfirm={() => onConfirm(trimmed)}
      onClose={onClose}
    >
      <label className="ax-field">
        <span className="ax-field-label">
          {reasonLabel}
          {reasonRequired ? " (required)" : " (optional)"}
        </span>
        <textarea
          className="ax-textarea"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded in the activity log"
        />
      </label>
    </ConfirmDialog>
  );
}

/** Date-range selector shared by the dashboard and analytics. Value: { range, from, to } */
export function RangePicker({ value, onChange }) {
  const presets = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
    { key: "custom", label: "Custom" },
  ];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="ax-range">
      <div className="admin-posts-status-filters" role="group" aria-label="Date range">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`admin-filter-pill ${value.range === p.key ? "active" : ""}`}
            aria-pressed={value.range === p.key}
            onClick={() =>
              onChange(
                p.key === "custom"
                  ? { range: "custom", from: value.from || today, to: value.to || today }
                  : { range: p.key, from: "", to: "" }
              )
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.range === "custom" && (
        <div className="ax-range-custom">
          <label>
            <span className="ax-select-label">From</span>
            <input
              type="date"
              value={value.from}
              max={value.to || today}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label>
            <span className="ax-select-label">To</span>
            <input
              type="date"
              value={value.to}
              min={value.from}
              max={today}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export const rangeToQuery = ({ range, from, to }) =>
  range === "custom" ? `range=custom&from=${from}&to=${to}` : `range=${range}`;

export const rangeIsValid = ({ range, from, to }) => range !== "custom" || Boolean(from && to && from <= to);

export const mutationRequest = async (apiFetch, path, { method = "POST", body } = {}) => {
  const res = await apiFetch(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};
