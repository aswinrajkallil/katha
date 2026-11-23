import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, AlertCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import "./Auth.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Set document title
  useEffect(() => {
    document.title = "Log in | Kathā";
  }, []);

  // Autofocus email field on desktop (>= 900px)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 900) {
      emailInputRef.current?.focus();
    }
  }, []);

  // Field validation
  const validateField = (name, value) => {
    if (name === "email") {
      if (!value.trim()) {
        return "Email is required";
      }
      if (!EMAIL_REGEX.test(value.trim())) {
        return "Please enter a valid email address";
      }
      return "";
    }
    if (name === "password") {
      if (!value) {
        return "Password is required";
      }
      return "";
    }
    return "";
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setBannerError("");

    // Re-validate on keystroke ONLY if the field was already blurred/touched
    if (touched[name]) {
      const error = validateField(name, value);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError("");

    // Validate both fields on submit
    const emailErr = validateField("email", formData.email);
    const passErr = validateField("password", formData.password);

    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr, password: passErr });

    if (emailErr) {
      emailInputRef.current?.focus();
      return;
    }
    if (passErr) {
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Server returned an invalid response (HTTP ${response.status})`);
      }

      if (!response.ok) {
        // Generic invalid credentials message to prevent user enumeration
        setBannerError(data.message || "Invalid email or password. Please try again.");
        triggerShake();
        passwordInputRef.current?.focus();
        return;
      }

      // Successful authentication
      const user = data.data.user;
      login(data.data.accessToken, user);

      // Toast welcome announcement
      const displayName = user.fullName || user.username || "there";
      toast.success(`Welcome back, ${displayName}!`);

      // Redirect to the originally intended destination or home
      const destination = location.state?.from || "/";
      navigate(destination, { replace: true });
    } catch (err) {
      console.error("Login failed:", err);
      const isNetworkErr = err.message === "Failed to fetch" || err.name === "TypeError";
      setBannerError(
        isNetworkErr
          ? "Unable to connect to the server. Please check your internet connection and try again."
          : err.message || "Login failed. Please try again."
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-form-inner ${isShaking ? "auth-shake" : ""}`}>
      <div className="auth-header-wrap">
        <h2 className="auth-heading">Welcome back</h2>
        <p className="auth-subheading">Log in to continue to Kathā</p>
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
        {/* Email Field */}
        <div className="auth-field-group">
          <label htmlFor="login-email" className="auth-label">
            Email
          </label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={emailInputRef}
              id="login-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => handleBlur("email")}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              className="auth-input"
            />
          </div>
          {fieldErrors.email && (
            <div id="login-email-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.email}</span>
            </div>
          )}
        </div>

        {/* Password Field */}
        <div className="auth-field-group">
          <div className="auth-label-row">
            <label htmlFor="login-password" className="auth-label">
              Password
            </label>
            <Link to="/forgot-password" className="auth-forgot-link">
              Forgot password?
            </Link>
          </div>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={passwordInputRef}
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => handleBlur("password")}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              className="auth-input"
            />
            <button
              type="button"
              className="auth-input-trailing-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && (
            <div id="login-password-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.password}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="auth-submit-btn"
          aria-label="Log in to Kathā"
        >
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log in</span>
          )}
        </button>
      </form>

      <div className="auth-bottom-row">
        <span>New to Kathā?</span>
        <Link to="/register" className="auth-link">
          Create account
        </Link>
      </div>
    </div>
  );
}
