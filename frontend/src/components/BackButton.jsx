import { useNavigate } from "react-router-dom";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import "./BackButton.css";

export default function BackButton({ to, onClick, className = "" }) {
  const navigate = useNavigate();
  const { triggerGuard } = useNavigationGuard();

  const handleClick = (e) => {
    // Check if dirty form or unsaved changes guard blocks navigation
    if (triggerGuard && triggerGuard()) {
      return;
    }

    if (onClick) {
      onClick(e);
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    // Check if user arrived via inside the app or direct link
    const hasInAppHistory = typeof window !== "undefined" && window.history.state?.idx > 0;
    if (hasInAppHistory) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <button
      type="button"
      className={`back-btn ${className}`}
      onClick={handleClick}
      aria-label="Go back"
      title="Back"
    >
      <span className="back-btn-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </span>
    </button>
  );
}
