import { Link, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./MobileWriteFab.css";

export default function MobileWriteFab() {
  const { user } = useAuth();
  const location = useLocation();

  // Only show if user is authenticated and not currently on create/edit post page
  if (!user) return null;
  if (
    location.pathname === "/posts/create" ||
    location.pathname.startsWith("/posts/") && location.pathname.endsWith("/edit")
  ) {
    return null;
  }

  return (
    <Link
      to="/posts/create"
      className="mobile-write-fab"
      aria-label="Write a story"
    >
      <Plus size={28} color="#ffffff" strokeWidth={2.5} />
    </Link>
  );
}
