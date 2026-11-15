import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileWriteFab from "./MobileWriteFab";
import "./Layout.css";

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    // If the user was on Home ("/") and navigates to any other page, mark welcome as seen
    if (prevPathRef.current === "/" && location.pathname !== "/") {
      try {
        const userId = user?._id || user?.id || "guest";
        localStorage.setItem(`katha_welcome_seen_${userId}`, "true");
      } catch {
        // Ignore storage errors
      }
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, user]);

  return (
    <div className="app-layout">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <MobileWriteFab />
    </div>
  );
}
