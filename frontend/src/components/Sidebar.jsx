import { NavLink } from "react-router-dom";
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
              For You
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/feed/following"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              Following
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/explore"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              Explore
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
                  My Posts
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/bookmarks"
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                >
                  Bookmarks
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
