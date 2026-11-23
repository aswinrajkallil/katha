import React, { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Shield, Lock, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import { isStaff, homeFor } from "./adminAccess";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { user, login, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated as admin, go straight to admin dashboard
  if (user && isStaff(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid credentials");
      }

      const userData = data.data?.user;
      const accessToken = data.data?.accessToken;

      if (!userData || !isStaff(userData.role)) {
        // Normal user attempted admin login: log out immediately and reject
        await logout();
        setError("Not authorized. Staff access required.");
        toast.error("Not authorized");
        return;
      }

      login(accessToken, userData);
      toast.success(`Welcome back, ${userData.fullName || userData.username}`);
      navigate(homeFor(userData.role), { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
      toast.error(err.message || "Login failed");
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
          <h1 className="admin-login-title">Kathā Admin</h1>
          <p className="admin-login-subtitle">Enter your admin credentials to access the console</p>
        </div>

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <label htmlFor="admin-email">Email Address</label>
            <div className="admin-input-wrapper">
              <Mail size={18} className="admin-input-icon" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@katha.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="admin-input-group">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrapper">
              <Lock size={18} className="admin-input-icon" />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="admin-forgot-row">
            <Link to="/admin/forgot-password" className="admin-link">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="admin-login-btn"
            disabled={loading}
          >
            {loading ? "Authenticating..." : (
              <>
                <span>Sign In to Admin</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
