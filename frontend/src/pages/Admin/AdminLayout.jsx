import React, { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  ExternalLink,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setConfirmLogout(false);
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      {/* Mobile Top Bar */}
      <header className="admin-mobile-topbar">
        <div className="admin-brand">
          <Shield size={20} color="#e8590c" />
          <span className="admin-brand-name">Kathā</span>
          <span className="admin-badge">ADMIN</span>
        </div>
        <button
          type="button"
          className="admin-menu-toggle"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Sidebar Nav */}
      <aside className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <div className="admin-brand">
            <Shield size={24} color="#e8590c" />
            <span className="admin-brand-name">Kathā</span>
            <span className="admin-badge">ADMIN</span>
          </div>
        </div>

        <div className="admin-user-card">
          <div className="admin-user-avatar">
            {(user?.fullName || user?.username || "A")[0].toUpperCase()}
          </div>
          <div className="admin-user-info">
            <span className="admin-user-name">{user?.fullName || user?.username}</span>
            <span className="admin-user-role">Administrator</span>
          </div>
        </div>

        <nav className="admin-nav" onClick={() => setMobileNavOpen(false)}>
          <div className="admin-nav-section-label">MANAGEMENT</div>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
          >
            <Users size={18} />
            <span>Users</span>
          </NavLink>

          <NavLink
            to="/admin/posts"
            className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
          >
            <FileText size={18} />
            <span>Posts</span>
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-footer-link" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} />
            <span>View site</span>
          </Link>

          <button
            type="button"
            className="admin-logout-btn"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Admin View Container */}
      <main className="admin-main-content">
        <Outlet />
      </main>

      <ConfirmDialog
        isOpen={confirmLogout}
        title="Log out of Admin?"
        message="Are you sure you want to end your administrative session?"
        confirmText="Log Out"
        onConfirm={handleLogout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
