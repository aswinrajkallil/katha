import { Link, NavLink, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Menu, X, Search, Bell, SlidersHorizontal } from "lucide-react";
import "./Navbar.css";
import logoFull from "../assets/katha-logo-full.svg";
import { useAuth } from "../context/AuthContext";

const dateOptions = [
  ["", "All time"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
  ["3months", "Last 3 months"],
  ["6months", "Last 6 months"],
  ["thisYear", "This year"]
];

const sortOptions = [
  ["latest", "Latest first"],
  ["oldest", "Oldest first"],
  ["mostViewed", "Most viewed"]
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const drawerRef = useRef(null);
  const filterPopoverRef = useRef(null);
  const filterBtnRef = useRef(null);

  // Sync state with URL search params
  const currentQ = searchParams.get("q") || "";
  const currentTime = searchParams.get("time") || "";
  const currentSort = searchParams.get("sort") || "latest";

  const [inputValue, setInputValue] = useState(currentQ);
  const [selectedTime, setSelectedTime] = useState(currentTime);
  const [selectedSort, setSelectedSort] = useState(currentSort);

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
        // If user is currently on an inner page like post details or create post, navigate to "/" with query
        const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
        if (!isFeedPage && trimmed) {
          navigate(`/?q=${encodeURIComponent(trimmed)}`);
        } else {
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (trimmed) {
              next.set("q", trimmed);
            } else {
              next.delete("q");
            }
            return next;
          }, { replace: true });
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
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (trimmed) next.set("q", trimmed);
        else next.delete("q");
        return next;
      }, { replace: true });
    }
  };

  const handleApplyFilters = () => {
    setFilterOpen(false);
    const isFeedPage = location.pathname === "/" || location.pathname === "/my-posts";
    if (!isFeedPage) {
      const params = new URLSearchParams();
      if (inputValue.trim()) params.set("q", inputValue.trim());
      if (selectedTime) params.set("time", selectedTime);
      if (selectedSort && selectedSort !== "latest") params.set("sort", selectedSort);
      const str = params.toString();
      navigate(str ? `/?${str}` : "/");
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (selectedTime) next.set("time", selectedTime);
        else next.delete("time");

        if (selectedSort && selectedSort !== "latest") next.set("sort", selectedSort);
        else next.delete("sort");

        return next;
      }, { replace: true });
    }
  };

  const handleResetFilters = () => {
    setSelectedTime("");
    setSelectedSort("latest");
    setFilterOpen(false);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("time");
      next.delete("sort");
      return next;
    }, { replace: true });
  };

  const hasFilterActive = Boolean(currentTime || (currentSort && currentSort !== "latest"));

  // Outside click & ESC listeners for drawer & filter popover / bottom sheet
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
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
        setDrawerOpen(false);
        setFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    if (drawerOpen || (filterOpen && window.innerWidth < 1024)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, filterOpen]);

  // Close overlays on route change
  useEffect(() => {
    setDrawerOpen(false);
    setFilterOpen(false);
    document.body.style.overflow = "";
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <nav className="navbar">
        {/* Top bar row */}
        <div className="navbar-container">
          {/* Mobile hamburger */}
          <button
            className="icon-btn menu-toggle"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </button>

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
                    onChange={(e) => setSelectedTime(e.target.value)}
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
                    onChange={(e) => setSelectedSort(e.target.value)}
                  >
                    {sortOptions.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-popover-footer">
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="filter-apply-btn"
                  >
                    Apply
                  </button>
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

        {/* Mobile Search Row (below 1024px) */}
        <div className="navbar-mobile-search-row">
          <form onSubmit={handleSearchSubmit} className="navbar-search mobile-navbar-search">
            <input
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
      </nav>

      {/* Mobile Filter Bottom Sheet */}
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
                onChange={(e) => setSelectedTime(e.target.value)}
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
                onChange={(e) => setSelectedSort(e.target.value)}
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
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="filter-apply-btn"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile drawer backdrop - only rendered when drawer is open */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={drawerRef}
        className={`drawer ${drawerOpen ? "open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <button
          className="icon-btn drawer-close"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
        >
          <X size={20} />
        </button>

        <nav className="drawer-nav">
          <p className="drawer-section-title">Feeds</p>
          <ul>
            <li>
              <NavLink to="/" end onClick={() => setDrawerOpen(false)}>
                For You
              </NavLink>
            </li>
            <li>
              <NavLink to="/feed/following" onClick={() => setDrawerOpen(false)}>
                Following
              </NavLink>
            </li>
            <li>
              <NavLink to="/explore" onClick={() => setDrawerOpen(false)}>
                Explore
              </NavLink>
            </li>
          </ul>

          {user && (
            <>
              <p className="drawer-section-title">Your Space</p>
              <ul>
                <li>
                  <NavLink to="/my-posts" onClick={() => setDrawerOpen(false)}>
                    My Posts
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/bookmarks" onClick={() => setDrawerOpen(false)}>
                    Bookmarks
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to={`/profile/${user.username || user._id}`}
                    onClick={() => setDrawerOpen(false)}
                  >
                    Profile
                  </NavLink>
                </li>
              </ul>
            </>
          )}
        </nav>

        {user && (
          <button className="drawer-logout" onClick={handleLogout}>
            Logout
          </button>
        )}
      </aside>
    </>
  );
}
