import { useNavigate, useLocation } from "react-router-dom";
import "./BackButton.css";

export default function BackButton({ to, label = "Back", className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    // Check if user arrived via direct link (new tab / initial history entry)
    if (location.key === "default" || window.history.length <= 1) {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      className={`back-btn ${className}`}
      onClick={handleClick}
      aria-label="Go back"
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
      <span className="back-btn-text">{label}</span>
    </button>
  );
}
