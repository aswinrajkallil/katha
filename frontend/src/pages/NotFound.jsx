import { Link } from "react-router-dom";

const NotFound = () => {
    return (
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <h1>404 — Page Not Found</h1>
            <p style={{ color: "#666" }}>The page you're looking for doesn't exist.</p>
            <Link to="/">← Back to Home</Link>
        </div>
    );
};

export default NotFound;
