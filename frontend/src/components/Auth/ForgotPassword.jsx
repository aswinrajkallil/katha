import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, AlertCircle, X, MailCheck } from "lucide-react";
import { requestPasswordReset } from "../../api/passwordReset";
import "./Auth.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailInputRef = useRef(null);

  useEffect(() => {
    document.title = "Forgot password | Kathā";
  }, []);

  // Autofocus on desktop only, so the keyboard does not pop up on phones
  useEffect(() => {
    if (!sent && typeof window !== "undefined" && window.innerWidth >= 900) {
      emailInputRef.current?.focus();
    }
  }, [sent]);

  const validate = (value) => {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_REGEX.test(value.trim())) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError("");
    const error = validate(email);
    setFieldError(error);
    if (error) {
      emailInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setBannerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form-inner">
        <div className="auth-success-panel" role="status">
          <div className="auth-success-icon" aria-hidden="true">
            <MailCheck size={28} />
          </div>
          <h2 className="auth-heading">Check your email</h2>
          <p className="auth-success-text">
            If an account exists for <strong>{email.trim()}</strong>, we have sent a link to reset
            your password. The link expires after a short time and can only be used once.
          </p>
          <p className="auth-success-text">
            Nothing yet? Check your spam folder, or{" "}
            <button type="button" className="auth-text-btn" onClick={() => setSent(false)}>
              try again
            </button>
            .
          </p>
        </div>
        <div className="auth-bottom-row">
          <Link to="/login" className="auth-link">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form-inner">
      <div className="auth-header-wrap">
        <h2 className="auth-heading">Forgot your password?</h2>
        <p className="auth-subheading">
          Enter your email and we will send you a link to reset it
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
        <div className="auth-field-group">
          <label htmlFor="forgot-email" className="auth-label">
            Email
          </label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={emailInputRef}
              id="forgot-email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setBannerError("");
                if (fieldError) setFieldError(validate(e.target.value));
              }}
              onBlur={() => setFieldError(validate(email))}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "forgot-email-error" : undefined}
              className="auth-input"
            />
          </div>
          {fieldError && (
            <div id="forgot-email-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldError}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-btn"
          aria-label="Send password reset link"
        >
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              <span>Sending...</span>
            </>
          ) : (
            <span>Send reset link</span>
          )}
        </button>
      </form>

      <div className="auth-bottom-row">
        <span>Remembered it?</span>
        <Link to="/login" className="auth-link">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
