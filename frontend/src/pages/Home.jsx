import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import WelcomeHero from "../components/WelcomeHero";
import PostList from "../components/Posts/PostList";
import FeedSidebar from "../components/FeedSidebar/FeedSidebar";
import "./Home.css";

const Home = () => {
    const { user } = useAuth();
    const userId = user?._id || user?.id || "guest";
    const storageKey = `katha_welcome_seen_${userId}`;

    // Read seen state initially from localStorage safely
    const [showWelcome] = useState(() => {
        try {
            return localStorage.getItem(storageKey) !== "true";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const markAsSeen = () => {
            try {
                localStorage.setItem(storageKey, "true");
            } catch {
                // Ignore storage errors
            }
        };

        const handleBeforeUnload = () => {
            markAsSeen();
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // StrictMode guard:
            // When navigating away to any other route, window.location.pathname is !== "/".
            // During dev StrictMode double-mount, window.location.pathname remains "/".
            if (window.location.pathname !== "/") {
                markAsSeen();
            }
        };
    }, [storageKey]);

    return (
        <div className="home-layout-container">
            <div className="home-main-column">
                {showWelcome && <WelcomeHero />}
                <PostList />
            </div>
            <FeedSidebar />
        </div>
    );
};

export default Home;
