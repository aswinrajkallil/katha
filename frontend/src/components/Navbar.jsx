import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <nav style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 24px",
            borderBottom: "1px solid #ddd",
            background: "#fff"
        }}>
            <Link to="/" style={{ fontWeight: "bold", fontSize: 20, textDecoration: "none", color: "#000" }}>
                Kathā
            </Link>

            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Link to="/">Home</Link>
                <Link to="/explore">Explore</Link>

                {user ? (
                    <>
                        <Link to="/my-posts">My Posts</Link>
                        <Link to="/bookmarks">Bookmarks</Link>
                        <Link to="/posts/create">+ New Post</Link>
                        <Link to={`/profile/${user._id}`}>{user.username}</Link>
                        <button onClick={handleLogout} style={{ cursor: "pointer" }}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
