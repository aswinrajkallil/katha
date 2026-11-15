import { PenLine, Users, Bookmark } from "lucide-react";
import logoFull from "../assets/katha-logo-full.svg";
import "./WelcomeHero.css";

export default function WelcomeHero() {
  return (
    <div className="welcome-hero-card" role="banner">
      <div className="welcome-hero-content">
        <div className="welcome-hero-brand">
          <img
            src={logoFull}
            alt="Kathā logo"
            className="welcome-hero-logo"
          />
        </div>
        <h1 className="welcome-hero-title">Welcome to Katha</h1>
        <p className="welcome-hero-subtitle">
          A space for stories, ideas, and videos to inspire and connect.
        </p>

        <div className="welcome-hero-chips">
          <span className="welcome-pill-chip">
            <span className="welcome-chip-icon-wrap">
              <PenLine size={13} strokeWidth={2.5} />
            </span>
            <span>Write</span>
          </span>
          <span className="welcome-pill-chip">
            <span className="welcome-chip-icon-wrap">
              <Users size={13} strokeWidth={2.5} />
            </span>
            <span>Follow</span>
          </span>
          <span className="welcome-pill-chip">
            <span className="welcome-chip-icon-wrap">
              <Bookmark size={13} strokeWidth={2.5} />
            </span>
            <span>Save</span>
          </span>
        </div>
      </div>
    </div>
  );
}
