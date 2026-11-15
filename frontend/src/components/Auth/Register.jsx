import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import "./Auth.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

export default function Register() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
  });

  const [fieldErrors, setFieldErrors] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Username live availability state: "idle" | "checking" | "available" | "taken" | "invalid"
  const [usernameStatus, setUsernameStatus] = useState("idle");

  const usernameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const checkTimeoutRef = useRef(null);

  // Set document title
  useEffect(() => {
    document.title = "Sign up | Kathā";
  }, []);

  // Autofocus username on desktop (>= 900px)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 900) {
      usernameInputRef.current?.focus();
    }
  }, []);

  // Password checklist evaluation
  const passwordCriteria = {
    length: formData.password.length >= 8,
    hasNumber: /\d/.test(formData.password),
    hasMixedCase: /[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password),
  };

  // Password strength calculation: 0 to 4
  const computePasswordStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pass)) score = Math.min(4, score + 1);
    return Math.min(4, Math.max(score ? 1 : 0, score));
  };

  const passwordStrength = computePasswordStrength(formData.password);

  const getStrengthMeta = (score) => {
    switch (score) {
      case 1:
        return { label: "Weak", class: "weak", textClass: "strength-text-weak" };
      case 2:
        return { label: "Fair", class: "fair", textClass: "strength-text-fair" };
      case 3:
        return { label: "Good", class: "good", textClass: "strength-text-good" };
      case 4:
        return { label: "Strong", class: "strong", textClass: "strength-text-strong" };
      default:
        return { label: "", class: "", textClass: "" };
    }
  };

  const strengthMeta = getStrengthMeta(passwordStrength);

  // Live debounced username check
  const checkUsernameAvailability = useCallback(async (usernameToCheck) => {
    if (!USERNAME_REGEX.test(usernameToCheck)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");

    try {
      const res = await apiFetch(`/check-username?username=${encodeURIComponent(usernameToCheck)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.available) {
        setUsernameStatus("available");
        setFieldErrors((prev) => ({ ...prev, username: "" }));
      } else {
        setUsernameStatus("taken");
        setFieldErrors((prev) => ({ ...prev, username: "Already taken" }));
      }
    } catch {
      // In case network check is unreachable, silently fallback to idle
      setUsernameStatus("idle");
    }
  }, []);

  const handleUsernameChange = (e) => {
    // Auto-lowercase and remove spaces
    const cleanValue = e.target.value.toLowerCase().replace(/\s+/g, "").slice(0, 20);
    setFormData((prev) => ({ ...prev, username: cleanValue }));
    setBannerError("");

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!cleanValue) {
      setUsernameStatus("idle");
      if (touched.username) {
        setFieldErrors((prev) => ({ ...prev, username: "Username is required" }));
      }
      return;
    }

    if (!USERNAME_REGEX.test(cleanValue)) {
      setUsernameStatus("invalid");
      if (touched.username) {
        setFieldErrors((prev) => ({
          ...prev,
          username: "3–20 characters, lowercase letters, numbers, underscores or dots",
        }));
      }
      return;
    }

    // Schedule live availability check debounced at 400ms
    setUsernameStatus("checking");
    checkTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(cleanValue);
    }, 400);
  };

  const validateField = (name, value) => {
    if (name === "username") {
      if (!value.trim()) return "Username is required";
      if (!USERNAME_REGEX.test(value)) {
        return "3–20 characters, lowercase letters, numbers, underscores or dots";
      }
      if (usernameStatus === "taken") return "Already taken";
      return "";
    }
    if (name === "email") {
      if (!value.trim()) return "Email is required";
      if (!EMAIL_REGEX.test(value.trim())) return "Please enter a valid email address";
      return "";
    }
    if (name === "password") {
      if (!value) return "Password is required";
      if (value.length < 8) return "Password must be at least 8 characters";
      return "";
    }
    return "";
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setFieldErrors((prev) => ({ ...prev, [field]: error }));

    if (field === "username" && formData.username && USERNAME_REGEX.test(formData.username)) {
      if (usernameStatus !== "available" && usernameStatus !== "taken") {
        checkUsernameAvailability(formData.username);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setBannerError("");

    if (touched[name]) {
      const error = validateField(name, value);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Form validity check for button enablement
  const isFormValid =
    USERNAME_REGEX.test(formData.username) &&
    usernameStatus === "available" &&
    EMAIL_REGEX.test(formData.email.trim()) &&
    formData.password.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError("");

    const userErr = validateField("username", formData.username);
    const emailErr = validateField("email", formData.email);
    const passErr = validateField("password", formData.password);

    setTouched({ username: true, email: true, password: true });
    setFieldErrors({ username: userErr, email: emailErr, password: passErr });

    if (userErr) {
      usernameInputRef.current?.focus();
      triggerShake();
      return;
    }
    if (emailErr) {
      emailInputRef.current?.focus();
      triggerShake();
      return;
    }
    if (passErr) {
      passwordInputRef.current?.focus();
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify({
          username: formData.username.trim(),
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
        const msg = data.message || "Registration failed";
        if (msg.toLowerCase().includes("email")) {
          setFieldErrors((prev) => ({ ...prev, email: msg }));
          emailInputRef.current?.focus();
        } else if (msg.toLowerCase().includes("username")) {
          setFieldErrors((prev) => ({ ...prev, username: msg }));
          setUsernameStatus("taken");
          usernameInputRef.current?.focus();
        } else {
          setBannerError(msg);
        }
        triggerShake();
        return;
      }

      // If API returned direct token, log in directly; otherwise redirect to login with Toast
      if (data.data?.accessToken) {
        login(data.data.accessToken, data.data.user);
        toast.success(`Welcome to Kathā, ${data.data.user.username}!`);
        const destination = location.state?.from || "/";
        navigate(destination, { replace: true });
      } else {
        toast.success("Account created successfully! Please log in to continue.");
        navigate("/login", { replace: true });
      }
    } catch (err) {
      console.error("Registration request failed:", err);
      const isNetworkErr = err.message === "Failed to fetch" || err.name === "TypeError";
      setBannerError(
        isNetworkErr
          ? "Unable to connect to the server. Please check your internet connection and try again."
          : err.message || "Registration failed. Please try again."
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-form-inner ${isShaking ? "auth-shake" : ""}`}>
      <div className="auth-header-wrap">
        <h2 className="auth-heading">Create your account</h2>
        <p className="auth-subheading">Join Kathā in less than a minute</p>
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
        {/* Username Field */}
        <div className="auth-field-group">
          <label htmlFor="register-username" className="auth-label">
            Username
          </label>
          <div className="auth-input-wrapper">
            <User size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={usernameInputRef}
              id="register-username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleUsernameChange}
              onBlur={() => handleBlur("username")}
              placeholder="e.g. sarah_writes"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby="register-username-rules"
              className="auth-input"
            />
            {/* Live availability check indicator */}
            <div className="auth-input-status-indicator">
              {usernameStatus === "checking" && (
                <span className="auth-spinner auth-spinner-sm" aria-label="Checking availability" />
              )}
              {usernameStatus === "available" && (
                <span className="status-available" title="Username available">
                  <CheckCircle2 size={18} />
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="status-taken" title="Already taken">
                  <XCircle size={18} />
                </span>
              )}
            </div>
          </div>
          {fieldErrors.username ? (
            <div id="register-username-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.username}</span>
            </div>
          ) : (
            <p id="register-username-rules" className="auth-field-helper">
              3–20 characters, lowercase letters, numbers, underscores or dots.
            </p>
          )}
        </div>

        {/* Email Field */}
        <div className="auth-field-group">
          <label htmlFor="register-email" className="auth-label">
            Email
          </label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={emailInputRef}
              id="register-email"
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
              aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
              className="auth-input"
            />
          </div>
          {fieldErrors.email && (
            <div id="register-email-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.email}</span>
            </div>
          )}
        </div>

        {/* Password Field */}
        <div className="auth-field-group">
          <label htmlFor="register-password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              ref={passwordInputRef}
              id="register-password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => handleBlur("password")}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
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

          {/* 4-Segment Strength Meter */}
          {formData.password && (
            <div className="auth-strength-meter" aria-live="polite">
              <div className="auth-strength-bars">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`auth-strength-bar ${
                      passwordStrength >= step ? strengthMeta.class : ""
                    }`}
                  />
                ))}
              </div>
              {strengthMeta.label && (
                <div className="auth-strength-label">
                  <span className={strengthMeta.textClass}>{strengthMeta.label}</span>
                </div>
              )}
            </div>
          )}

          {/* Requirements Checklist */}
          <div className="auth-password-checklist">
            <div
              className={`auth-checklist-item ${
                passwordCriteria.length ? "satisfied" : ""
              }`}
            >
              <span className="auth-checklist-bullet">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>At least 8 characters</span>
            </div>
            <div
              className={`auth-checklist-item ${
                passwordCriteria.hasNumber ? "satisfied" : ""
              }`}
            >
              <span className="auth-checklist-bullet">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Contains a number (0-9)</span>
            </div>
            <div
              className={`auth-checklist-item ${
                passwordCriteria.hasMixedCase ? "satisfied" : ""
              }`}
            >
              <span className="auth-checklist-bullet">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Uppercase and lowercase letters</span>
            </div>
          </div>

          {fieldErrors.password && (
            <div id="register-password-error" className="auth-inline-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.password}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="auth-submit-btn"
          aria-label="Create your account"
        >
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>

        {/* Terms Disclaimer */}
        <p className="auth-terms-text">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>

      <div className="auth-bottom-row">
        <span>Already have an account?</span>
        <Link to="/login" className="auth-link">
          Log in
        </Link>
      </div>
    </div>
  );
}
