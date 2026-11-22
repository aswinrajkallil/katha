import React, { useState } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import apiFetch from "../api/api";
import ConfirmDialog from "./ConfirmDialog";

const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment or bullying"],
  ["hate_speech", "Hate speech"],
  ["inappropriate_content", "Inappropriate content"],
  ["impersonation", "Impersonation"],
  ["copyright_violation", "Copyright violation"],
  ["misinformation", "Misinformation"],
  ["other", "Something else"],
];

const NOUN = { post: "post", comment: "comment", user: "profile" };

/**
 * Lets a signed-in member report a post, comment or profile. Renders nothing for signed-out
 * visitors and for the owner of the content (the API rejects self-reports as well).
 */
export default function ReportButton({ targetType, targetId, ownerId, className = "", label = "Report", showLabel = true }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const myId = user?._id || user?.id;
  if (!user || !targetId || (ownerId && myId && String(ownerId) === String(myId))) return null;

  const close = () => {
    setOpen(false);
    setReason("");
    setDescription("");
  };

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const res = await apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify({ targetType, targetId, reason, description: description.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Could not submit your report");
      toast.success(data.message || "Thanks, your report was submitted");
      close();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Report this ${NOUN[targetType]}`} title={`Report this ${NOUN[targetType]}`}>
        <Flag size={15} />
        {showLabel && <span>{label}</span>}
      </button>
      <ConfirmDialog
        isOpen={open}
        title={`Report this ${NOUN[targetType]}`}
        message="Tell us what is wrong. Our moderators review every report."
        confirmText="Submit report"
        loading={busy}
        confirmDisabled={!reason || (reason === "other" && description.trim().length < 5)}
        danger={false}
        onConfirm={submit}
        onClose={close}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", font: "inherit" }}>
            <option value="">Select a reason…</option>
            {REASONS.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{reason === "other" ? "Details (required)" : "Details (optional)"}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", font: "inherit", resize: "vertical" }}
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
