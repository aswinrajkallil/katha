import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MobileWriteFab from "./MobileWriteFab";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="app-layout">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>
      <MobileWriteFab />
    </div>
  );
}
