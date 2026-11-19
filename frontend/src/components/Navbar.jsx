import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Bell, X, Plus } from "lucide-react";
import "./Navbar.css";
import logoFull from "../assets/katha-logo-full.svg";
import { useAuth } from "../context/AuthContext";
import { getRouteInfo } from "../routes/routeConfig";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import { queryKeys } from "../api/queryClient";
import { apiQuery } from "../api/api";
import UserAvatar from "./UserAvatar";

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { triggerGuard } = useNavigationGuard();

  const { data: unreadData } = useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: () => apiQuery("/notifications/unread-count"),
    enabled: Boolean(user),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = unreadData?.count ?? 0;

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const desktopSearchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  // Sync state with URL search params
  const currentQ = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(currentQ);

  // Resolve route configuration for top-level vs secondary page mode
  const routeInfo = getRouteInfo(location.pathname, searchParams, user);

  // Automatically keep mobile search input open if URL has a search query
  useEffect(() => {
    if (currentQ) {
      setMobileSearchOpen(true);
    }
  }, [currentQ]);

  // Keep input synced if URL changes from outside
  useEffect(() => {
    setInputValue(currentQ);
  }, [currentQ]);

  // Debounced auto-search (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = inputValue.trim();
      const existingQ = searchParams.get("q") || "";
      if (trimmed !== existingQ) {
        const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
        if (!isFeedPage && trimmed) {
          navigate(`/?q=${encodeURIComponent(trimmed)}`);
        } else {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (trimmed) {
                next.set("q", trimmed);
              } else {
                next.delete("q");
              }
              return next;
            },
            { replace: true }
          );
        }
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [inputValue, searchParams, setSearchParams, location.pathname, navigate]);

  // Global keyboard shortcut: "/" to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable
      ) {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          setMobileSearchOpen(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
        } else {
          desktopSearchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
    if (!isFeedPage) {
      navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
    } else {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) next.set("q", trimmed);
          else next.delete("q");
          return next;
        },
        { replace: true }
      );
    }
  };

  const handleClearInput = (isMobile = false) => {
    setInputValue("");
    const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
    if (isFeedPage) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("q");
          return next;
        },
        { replace: true }
      );
    }
    if (isMobile) {
      mobileSearchInputRef.current?.focus();
    } else {
      desktopSearchInputRef.current?.focus();
    }
  };

  const handleInputKeyDown = (e, isMobile = false) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (inputValue) {
        handleClearInput(isMobile);
      } else {
        if (isMobile) {
          setMobileSearchOpen(false);
        }
        e.target.blur();
      }
    }
  };

  // Mobile Back button click handler
  const handleBackClick = () => {
    if (triggerGuard && triggerGuard()) {
      return;
    }
    const hasInAppHistory = typeof window !== "undefined" && window.history.state?.idx > 0;
    if (hasInAppHistory) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  // Focus search input when mobile search toggles open
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 50);
    }
  }, [mobileSearchOpen]);

  return (
    <nav className="navbar">
      {/* =========================================
          DESKTOP HEADER (>= 1024px)
      ========================================= */}
      <div className="navbar-container desktop-only-header">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <img src={logoFull} alt="Katha logo" className="navbar-logo" />
        </Link>

        {/* Desktop search bar */}
        <div className="navbar-search-desktop-wrapper">
          <form onSubmit={handleSearchSubmit} className="navbar-search">
            <input
              ref={desktopSearchInputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => handleInputKeyDown(e, false)}
              placeholder="Search stories, ideas, videos..."
              aria-label="Search stories, ideas, videos"
            />

            {/* Clear button when input has text */}
            {inputValue && (
              <button
                type="button"
                className="navbar-search-clear-btn"
                onClick={() => handleClearInput(false)}
                aria-label="Clear search text"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}

            {/* Orange search submit button */}
            <button
              type="submit"
              className="navbar-search-submit-btn"
              aria-label="Search"
              title="Search"
            >
              <Search size={16} color="#ffffff" strokeWidth={2.5} />
            </button>
          </form>
        </div>

        {/* Right actions */}
        <div className="navbar-actions">
          {user ? (
            <>
              <Link to="/posts/create" className="write-link">
                <Plus size={16} strokeWidth={2} />
                <span>Write</span>
              </Link>

              <Link to="/notifications" className="icon-btn" aria-label="Notifications">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </Link>

              <Link
                to={`/profile/${user.username || user._id}`}
                style={{ display: "inline-flex", textDecoration: "none" }}
                aria-label="Profile"
              >
                <UserAvatar user={user} size={32} />
              </Link>
            </>
          ) : (
            <div className="auth-links">
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          MOBILE HEADER (< 1024px)
      ========================================= */}
      <div className="navbar-container mobile-only-header">
        <div className="mobile-header-left">
          {routeInfo.isTopLevel ? (
            <Link to="/" className="navbar-brand mobile-brand-left" aria-label="Katha Home">
              <img src={logoFull} alt="Katha logo" className="navbar-logo" />
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="mobile-header-back-btn"
                onClick={handleBackClick}
                aria-label="Go back"
              >
                <ArrowLeft size={22} color="#111111" strokeWidth={2.2} />
              </button>
              <h1 className="mobile-header-title" title={routeInfo.title}>
                {routeInfo.title}
              </h1>
            </>
          )}
        </div>

        <div className="mobile-header-right">
          {/* Search Icon button */}
          <button
            type="button"
            className={`icon-btn mobile-header-icon-btn ${mobileSearchOpen ? "active" : ""}`}
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            aria-label="Search"
            aria-expanded={mobileSearchOpen}
          >
            <Search size={20} color="#111111" />
          </button>

          {/* Notifications Bell */}
          <Link
            to="/notifications"
            className="icon-btn mobile-header-icon-btn"
            aria-label="Notifications"
          >
            <Bell size={20} color="#111111" />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </Link>
        </div>
      </div>

      {/* =========================================
          MOBILE SEARCH ROW (Collapsible / Toggleable)
      ========================================= */}
      {mobileSearchOpen && (
        <div className="navbar-mobile-search-row">
          <form onSubmit={handleSearchSubmit} className="navbar-search mobile-navbar-search">
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => handleInputKeyDown(e, true)}
              placeholder="Search stories, ideas, videos..."
              aria-label="Search stories, ideas, videos"
            />

            {inputValue && (
              <button
                type="button"
                className="navbar-search-clear-btn"
                onClick={() => handleClearInput(true)}
                aria-label="Clear search text"
              >
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              className="navbar-search-submit-btn"
              aria-label="Search"
            >
              <Search size={16} color="#ffffff" strokeWidth={2.5} />
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
