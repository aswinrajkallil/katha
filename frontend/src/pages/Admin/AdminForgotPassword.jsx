import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Mail, ArrowRight } from "lucide-react";
import { requestPasswordReset } from "../../api/passwordReset";
import "./AdminLogin.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-icon">
            <Shield size={32} color="#e8590c" />
          </div>
          <h1 className="admin-login-title">Reset admin password</h1>
          <p className="admin-login-subtitle">
            Enter your account email and we will send you a reset link
          </p>
        </div>

        {sent && (
          <div className="admin-login-success" role="status">
            If an account exists for {email.trim()}, a reset link has been sent. It expires after a
            short time and can only be used once.
          </div>
        )}

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          <div className="admin-input-group">
            <label htmlFor="admin-forgot-email">Email Address</label>
            <div className="admin-input-wrapper">
              <Mail size={18} className="admin-input-icon" />
              <input
                id="admin-forgot-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="admin@katha.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? (
              "Sending..."
            ) : (
              <>
                <span>{sent ? "Send again" : "Send reset link"}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <Link to="/admin/login" className="admin-link">
            Back to admin sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
