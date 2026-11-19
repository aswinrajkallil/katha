import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Sparkles, Users, Compass, Bookmark, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getRouteInfo } from "../routes/routeConfig";
import "./BottomNav.css";

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeInfo = getRouteInfo(location.pathname, searchParams, user);

  const profilePath = user
    ? `/profile/${user.username || user._id}`
    : "/login";

  const tabs = [
    {
      id: "home",
      label: "For You",
      to: "/",
      icon: Sparkles,
    },
    {
      id: "following",
      label: "Following",
      to: "/feed/following",
      icon: Users,
    },
    {
      id: "explore",
      label: "Explore",
      to: "/explore",
      icon: Compass,
    },
    {
      id: "bookmarks",
      label: "Bookmarks",
      to: user ? "/bookmarks" : "/login",
      icon: Bookmark,
    },
    {
      id: "profile",
      label: "Profile",
      to: profilePath,
      icon: User,
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <div className="bottom-nav-container">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          // Active ONLY if routeInfo explicitly maps to this tabId
          const isActive = routeInfo.tabId === tab.id;

          return (
            <Link
              key={tab.id}
              to={tab.to}
              className={`bottom-nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="bottom-nav-icon-wrap">
                <IconComponent size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                {isActive && <span className="bottom-nav-active-dot" />}
              </div>
              <span className="bottom-nav-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
