import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Shield, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { completePasswordReset } from "../../api/passwordReset";
import "./AdminLogin.css";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export default function AdminResetPassword() {
  const { token } = useParams();
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password.length > MAX_LENGTH) {
      setError(`Password must be at most ${MAX_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await completePasswordReset(token, password);
      // A reset signs the account out everywhere on the server; clear this browser's session too.
      if (user) await logout();
      toast.success("Password updated. Sign in with your new password.");
      navigate("/admin/login", { replace: true });
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
          <h1 className="admin-login-title">Choose a new password</h1>
          <p className="admin-login-subtitle">
            Use at least {MIN_LENGTH} characters. You will be signed out everywhere else.
          </p>
        </div>

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          <div className="admin-input-group">
            <label htmlFor="admin-new-password">New password</label>
            <div className="admin-input-wrapper">
              <Lock size={18} className="admin-input-icon" />
              <input
                id="admin-new-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                autoFocus
              />
            </div>
          </div>

          <div className="admin-input-group">
            <label htmlFor="admin-confirm-password">Confirm new password</label>
            <div className="admin-input-wrapper">
              <Lock size={18} className="admin-input-icon" />
              <input
                id="admin-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? (
              "Updating..."
            ) : (
              <>
                <span>Update password</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <span>Link not working? </span>
          <Link to="/admin/forgot-password" className="admin-link">
            Request a new one
          </Link>
        </div>
      </div>
    </div>
  );
}
