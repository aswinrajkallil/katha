import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import "./ConfirmDialog.css";
import logoFull from "../assets/katha-logo-full.svg";

export default function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onClose,
  loading = false,
  danger = true,
  actions = null,
}) {
  const dialogRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
      // Simple focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={() => {
        if (!loading) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="confirm-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="confirm-dialog-top">
          <img src={logoFull} alt="Kathā" className="confirm-dialog-logo" />
          <button
            type="button"
            className="confirm-dialog-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="confirm-dialog-body">
          <div className={`confirm-dialog-icon ${danger ? "icon-danger" : "icon-warn"}`}>
            {danger ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div className="confirm-dialog-text">
            <h3 id="confirm-dialog-title" className="confirm-dialog-title">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="confirm-dialog-desc">
              {message}
            </p>
          </div>
        </div>

        {actions && Array.isArray(actions) && actions.length > 0 ? (
          <div className="confirm-dialog-actions confirm-dialog-actions-multi">
            {actions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                className={
                  act.variant === "primary"
                    ? "confirm-btn-action confirm-btn-primary"
                    : act.variant === "danger"
                    ? "confirm-btn-action confirm-btn-danger"
                    : "confirm-btn-cancel"
                }
                onClick={act.onClick}
                disabled={act.disabled || act.loading || loading}
              >
                {act.loading ? <span className="confirm-btn-spinner" /> : act.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="confirm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              className={`confirm-btn-action ${danger ? "confirm-btn-danger" : "confirm-btn-primary"}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <span className="confirm-btn-spinner" />
              ) : (
                confirmText
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
