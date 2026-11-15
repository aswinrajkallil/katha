import { NavLink } from "react-router-dom";
import { Sparkles, Users, Compass, FileText, Bookmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="desktop-sidebar">
      <nav className="desktop-sidebar-nav">
        <p className="sidebar-section-title">Feeds</p>
        <ul className="sidebar-list">
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon-tile">
                <Sparkles size={18} />
              </span>
              <span className="sidebar-label">For You</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/feed/following"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon-tile">
                <Users size={18} />
              </span>
              <span className="sidebar-label">Following</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/explore"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon-tile">
                <Compass size={18} />
              </span>
              <span className="sidebar-label">Explore</span>
            </NavLink>
          </li>
        </ul>

        {user && (
          <>
            <p className="sidebar-section-title">Your Space</p>
            <ul className="sidebar-list">
              <li>
                <NavLink
                  to="/my-posts"
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                >
                  <span className="sidebar-icon-tile">
                    <FileText size={18} />
                  </span>
                  <span className="sidebar-label">My Posts</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/bookmarks"
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                >
                  <span className="sidebar-icon-tile">
                    <Bookmark size={18} />
                  </span>
                  <span className="sidebar-label">Bookmarks</span>
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
