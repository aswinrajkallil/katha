import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, AlertCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { completePasswordReset } from "../../api/passwordReset";
import "./Auth.css";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export default function ResetPassword() {
  const { token } = useParams();
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: "", confirm: "" });
  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef(null);
  const confirmInputRef = useRef(null);

  useEffect(() => {
    document.title = "Reset password | Kathā";
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 900) {
      passwordInputRef.current?.focus();
    }
  }, []);

  const validate = (nextPassword, nextConfirm) => ({
    password:
      nextPassword.length < MIN_LENGTH
        ? `Password must be at least ${MIN_LENGTH} characters`
        : nextPassword.length > MAX_LENGTH
          ? `Password must be at most ${MAX_LENGTH} characters`
          : "",
    confirm: nextConfirm !== nextPassword ? "Passwords do not match" : "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError("");

    const errors = validate(password, confirm);
    setFieldErrors(errors);
    if (errors.password) {
      passwordInputRef.current?.focus();
      return;
    }
    if (errors.confirm) {
      confirmInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset(token, password);
      // A reset signs the account out everywhere on the server; clear this browser's session too.
      if (user) await logout();
      toast.success("Password updated. Log in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setBannerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordField = ({ id, label, value, onChange, error, inputRef, placeholder, withToggle }) => (
    <div className="auth-field-group">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className="auth-input-wrapper">
        <Lock size={18} className="auth-input-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
          required
          disabled={loading}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="auth-input"
        />
        {withToggle && (
          <button
            type="button"
            className="auth-input-trailing-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide passwords" : "Show passwords"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <div id={`${id}-error`} className="auth-inline-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="auth-form-inner">
      <div className="auth-header-wrap">
        <h2 className="auth-heading">Choose a new password</h2>
        <p className="auth-subheading">
          Use at least {MIN_LENGTH} characters. You will be logged out everywhere else.
        </p>
      </div>

      {bannerError && (
        <div className="auth-error-banner" role="alert" aria-live="polite">
          <div className="auth-error-banner-left">
            <AlertCircle size={18} className="auth-error-banner-icon" />
            <span className="auth-error-banner-text">{bannerError}</span>
          </div>
          <button
            type="button"
            className="auth-error-banner-close"
            onClick={() => setBannerError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        {renderPasswordField({
          id: "reset-password",
          label: "New password",
          value: password,
          onChange: (e) => {
            setPassword(e.target.value);
            setBannerError("");
            if (fieldErrors.password || fieldErrors.confirm) setFieldErrors(validate(e.target.value, confirm));
          },
          error: fieldErrors.password,
          inputRef: passwordInputRef,
          placeholder: "Enter a new password",
          withToggle: true,
        })}
        {renderPasswordField({
          id: "reset-password-confirm",
          label: "Confirm new password",
          value: confirm,
          onChange: (e) => {
            setConfirm(e.target.value);
            setBannerError("");
            if (fieldErrors.confirm) {
              setFieldErrors((prev) => ({ ...prev, confirm: validate(password, e.target.value).confirm }));
            }
          },
          error: fieldErrors.confirm,
          inputRef: confirmInputRef,
          placeholder: "Re-enter the new password",
          withToggle: false,
        })}

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-btn"
          aria-label="Set new password"
        >
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              <span>Updating...</span>
            </>
          ) : (
            <span>Update password</span>
          )}
        </button>
      </form>

      <div className="auth-bottom-row">
        <span>Link not working?</span>
        <Link to="/forgot-password" className="auth-link">
          Request a new one
        </Link>
      </div>
    </div>
  );
}
