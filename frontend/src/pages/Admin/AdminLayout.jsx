import React, { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Flag,
  Tags,
  Star,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings,
  ExternalLink,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAdminAccess, ROLE_LABELS } from "./adminAccess";
import "./AdminLayout.css";

const NAV_ITEMS = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { to: "/admin/users", label: "Users", icon: Users, permission: "users:view" },
  { to: "/admin/posts", label: "Posts", icon: FileText, permission: "posts:view" },
  { to: "/admin/comments", label: "Comments", icon: MessageSquare, permission: "comments:view" },
  { to: "/admin/reports", label: "Reports", icon: Flag, permission: "reports:view" },
  { to: "/admin/categories", label: "Categories", icon: Tags, permission: "categories:manage" },
  { to: "/admin/featured", label: "Featured Posts", icon: Star, permission: "featured:manage" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" },
  { to: "/admin/management", label: "Admin Management", icon: ShieldCheck, permission: "roles:manage" },
  { to: "/admin/activity", label: "Activity Logs", icon: ScrollText, permission: "audit:view" },
  { to: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { can, role } = useAdminAccess();
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
          <span className="admin-badge">{role === "moderator" ? "MOD" : "ADMIN"}</span>
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
            <span className="admin-badge">{role === "moderator" ? "MOD" : "ADMIN"}</span>
          </div>
        </div>

        <div className="admin-user-card">
          <div className="admin-user-avatar">
            {(user?.fullName || user?.username || "A")[0].toUpperCase()}
          </div>
          <div className="admin-user-info">
            <span className="admin-user-name">{user?.fullName || user?.username}</span>
            <span className="admin-user-role">{ROLE_LABELS[role] || "Staff"}</span>
          </div>
        </div>

        <nav className="admin-nav" onClick={() => setMobileNavOpen(false)}>
          <div className="admin-nav-section-label">MANAGEMENT</div>
          {NAV_ITEMS.filter((item) => can(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
