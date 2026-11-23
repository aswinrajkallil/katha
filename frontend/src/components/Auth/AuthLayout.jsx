import { Outlet, Navigate, Link } from "react-router-dom";
import { PenLine, Users, Bookmark } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logoFull from "../../assets/katha-logo-full.svg";
import "./AuthLayout.css";

// `allowAuthenticated` is for pages a signed-in visitor can legitimately open, such as the
// password reset link from an email (which may be clicked in a browser that is still logged in).
export default function AuthLayout({ allowAuthenticated = false }) {
  const { user, loading } = useAuth();

  // If already logged in, redirect to home
  if (!loading && user && !allowAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-layout-wrapper">
      {/* Desktop Brand Panel (Split Screen Left Half) */}
      <aside className="auth-brand-panel" aria-label="Kathā Brand Information">
        <div className="auth-brand-content">
          <Link to="/" className="auth-brand-logo-link" aria-label="Kathā Home">
            <div className="auth-brand-logo-pill">
              <span className="auth-brand-k">K</span>
              <span className="auth-brand-word">Kathā</span>
            </div>
          </Link>

          <div className="auth-brand-hero">
            <h1 className="auth-brand-title">
              A space for stories, ideas, and perspectives.
            </h1>
            <p className="auth-brand-tagline">
              Stories, ideas and videos from people you follow.
            </p>
          </div>

          <div className="auth-features-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrap">
                <PenLine size={20} color="#ffffff" strokeWidth={2.2} />
              </div>
              <div className="auth-feature-text">
                <h3>Write your story</h3>
                <p>Share ideas, articles, and viewpoints with an engaged audience.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrap">
                <Users size={20} color="#ffffff" strokeWidth={2.2} />
              </div>
              <div className="auth-feature-text">
                <h3>Follow people you like</h3>
                <p>Stay up to date with creators, writers, and thinkers that inspire you.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrap">
                <Bookmark size={20} color="#ffffff" strokeWidth={2.2} />
              </div>
              <div className="auth-feature-text">
                <h3>Save for later</h3>
                <p>Build your personal reading list and revisit favorite stories anytime.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>© {new Date().getFullYear()} Kathā. All rights reserved.</span>
        </div>
      </aside>

      {/* Main Form Container (Right Half on Desktop, Single Column on Mobile) */}
      <main className="auth-main-panel">
        <div className="auth-form-card">
          {/* Mobile-only compact logo */}
          <div className="auth-mobile-header">
            <Link to="/" aria-label="Kathā Home">
              <img src={logoFull} alt="Kathā" className="auth-mobile-logo" />
            </Link>
          </div>

          {/* Login or Register Route View */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
