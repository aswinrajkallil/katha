import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Search, Bell, SlidersHorizontal, X } from "lucide-react";
import "./Navbar.css";
import logoFull from "../assets/katha-logo-full.svg";
import { useAuth } from "../context/AuthContext";
import { getRouteInfo } from "../routes/routeConfig";
import { useNavigationGuard } from "../context/NavigationGuardContext";

const dateOptions = [
  ["", "All time"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
  ["3months", "Last 3 months"],
  ["6months", "Last 6 months"],
  ["thisYear", "This year"],
];

const sortOptions = [
  ["latest", "Latest first"],
  ["oldest", "Oldest first"],
  ["mostViewed", "Most viewed"],
];

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { triggerGuard } = useNavigationGuard();

  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const filterPopoverRef = useRef(null);
  const filterBtnRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  // Sync state with URL search params
  const currentQ = searchParams.get("q") || "";
  const currentTime = searchParams.get("time") || "";
  const currentSort = searchParams.get("sort") || "latest";

  const [inputValue, setInputValue] = useState(currentQ);
  const [selectedTime, setSelectedTime] = useState(currentTime);
  const [selectedSort, setSelectedSort] = useState(currentSort);

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

  useEffect(() => {
    setSelectedTime(currentTime);
  }, [currentTime]);

  useEffect(() => {
    setSelectedSort(currentSort);
  }, [currentSort]);

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

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
    if (!isFeedPage) {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (selectedTime) params.set("time", selectedTime);
      if (selectedSort && selectedSort !== "latest") params.set("sort", selectedSort);
      const str = params.toString();
      navigate(str ? `/?${str}` : "/");
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

  const updateFilterParam = (key, val) => {
    const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
    const nextTime = key === "time" ? val : selectedTime;
    const nextSort = key === "sort" ? val : selectedSort;

    if (!isFeedPage) {
      const params = new URLSearchParams();
      if (inputValue.trim()) params.set("q", inputValue.trim());
      if (nextTime) params.set("time", nextTime);
      if (nextSort && nextSort !== "latest") params.set("sort", nextSort);
      const str = params.toString();
      navigate(str ? `/?${str}` : "/");
    } else {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextTime) {
            next.set("time", nextTime);
          } else {
            next.delete("time");
          }

          if (nextSort && nextSort !== "latest") {
            next.set("sort", nextSort);
          } else {
            next.delete("sort");
          }
          return next;
        },
        { replace: true }
      );
    }
  };

  const handleTimeChange = (newVal) => {
    setSelectedTime(newVal);
    updateFilterParam("time", newVal);
  };

  const handleSortChange = (newVal) => {
    setSelectedSort(newVal);
    updateFilterParam("sort", newVal);
  };

  const handleResetFilters = () => {
    setSelectedTime("");
    setSelectedSort("latest");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("time");
        next.delete("sort");
        return next;
      },
      { replace: true }
    );
  };

  const hasFilterActive = Boolean(currentTime || (currentSort && currentSort !== "latest"));

  // Mobile Back button click handler
  const handleBackClick = () => {
    // If a guard is registered (e.g. unsaved changes in Create/Edit post), trigger it
    if (triggerGuard && triggerGuard()) {
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

  // Outside click & ESC listeners for filter popover / bottom sheet
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target)
      ) {
        setFilterOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setMobileSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    if (filterOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  // Focus search input when mobile search toggles open
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 50);
    }
  }, [mobileSearchOpen]);

  // Close filter overlay on route change
  useEffect(() => {
    setFilterOpen(false);
    document.body.style.overflow = "";
  }, [location.pathname]);

  return (
    <>
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
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search stories, ideas, videos..."
                aria-label="Search stories, ideas, videos"
              />

              {/* Filter button */}
              <button
                type="button"
                ref={filterBtnRef}
                className="navbar-search-filter-btn"
                onClick={() => setFilterOpen((prev) => !prev)}
                aria-label="Filters"
                title="Filters"
              >
                <SlidersHorizontal size={18} />
                {hasFilterActive && <span className="filter-badge-dot" />}
              </button>

              {/* Orange search submit button */}
              <button
                type="submit"
                className="navbar-search-submit-btn"
                aria-label="Search"
              >
                <Search size={18} color="#ffffff" strokeWidth={2.5} />
              </button>
            </form>

            {/* Desktop Filter Popover */}
            {filterOpen && (
              <div ref={filterPopoverRef} className="filter-popover" role="dialog" aria-label="Filters">
                <div className="filter-popover-header">
                  <span className="filter-popover-title">Filters</span>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="filter-reset-link"
                  >
                    Reset
                  </button>
                </div>

                <div className="filter-form-group">
                  <label htmlFor="filter-time">Time</label>
                  <select
                    id="filter-time"
                    value={selectedTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                  >
                    {dateOptions.map(([val, label]) => (
                      <option key={val || "all"} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-form-group">
                  <label htmlFor="filter-sort">Sort by</label>
                  <select
                    id="filter-sort"
                    value={selectedSort}
                    onChange={(e) => handleSortChange(e.target.value)}
                  >
                    {sortOptions.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="navbar-actions">
            {user ? (
              <>
                <Link to="/posts/create" className="write-link">
                  + Write
                </Link>

                <Link to="/notifications" className="icon-btn" aria-label="Notifications">
                  <Bell size={20} />
                  <span className="notif-badge"></span>
                </Link>

                <Link
                  to={`/profile/${user.username || user._id}`}
                  className="avatar-link"
                  aria-label="Profile"
                >
                  {user.username?.[0]?.toUpperCase() || "U"}
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
            Mode 1 (Top-level): Logo on left, Search & Bell on right
            Mode 2 (Secondary): Back arrow + Title on left, Search & Bell on right
        ========================================= */}
        <div className="navbar-container mobile-only-header">
          <div className="mobile-header-left">
            {routeInfo.isTopLevel ? (
              /* Mode 1: Top-level page - Logo on the left, NO back button */
              <Link to="/" className="navbar-brand mobile-brand-left" aria-label="Katha Home">
                <img src={logoFull} alt="Katha logo" className="navbar-logo" />
              </Link>
            ) : (
              /* Mode 2: Secondary page - Back arrow + short title, Logo hidden */
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
              <span className="notif-badge"></span>
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
                placeholder="Search stories, ideas, videos..."
                aria-label="Search stories, ideas, videos"
              />

              <button
                type="button"
                className="navbar-search-filter-btn"
                onClick={() => setFilterOpen(true)}
                aria-label="Filters"
                title="Filters"
              >
                <SlidersHorizontal size={18} />
                {hasFilterActive && <span className="filter-badge-dot" />}
              </button>

              <button
                type="submit"
                className="navbar-search-submit-btn"
                aria-label="Search"
              >
                <Search size={18} color="#ffffff" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        )}
      </nav>

      {/* =========================================
          MOBILE FILTER BOTTOM SHEET
      ========================================= */}
      {filterOpen && (
        <div
          className="mobile-filter-backdrop"
          onClick={() => setFilterOpen(false)}
          aria-hidden="true"
        >
          <div
            className="mobile-filter-bottom-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Filters"
          >
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-header">
              <h3>Filters</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>

            <div className="filter-form-group">
              <label htmlFor="mobile-filter-time">Time</label>
              <select
                id="mobile-filter-time"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
              >
                {dateOptions.map(([val, label]) => (
                  <option key={val || "all"} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-form-group">
              <label htmlFor="mobile-filter-sort">Sort by</label>
              <select
                id="mobile-filter-sort"
                value={selectedSort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {sortOptions.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mobile-filter-sheet-footer">
              <button
                type="button"
                onClick={handleResetFilters}
                className="filter-reset-outline-btn"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
