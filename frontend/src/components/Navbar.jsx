import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import './Navbar.css';
import Logo from "../assets/katha-logo.svg";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => { await logout(); navigate("/login"); };
    const [navOpen, setNavOpen] = useState(false);

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand"><img src={Logo} alt="Kathā logo" className="logo" />Kathā</Link>
            <button className="menu-toggle" onClick={() => setNavOpen(!navOpen)}>☰</button>
            <div className={`nav-items ${navOpen ? 'show' : ''}`}>
                <Link to="/">Home</Link><Link to="/explore">Explore</Link><Link to="/search">Search</Link>
                {user ? <>
                    <Link to="/feed/following">Following feed</Link>
                    <Link to="/notifications">Notifications</Link>
                    <Link to="/my-posts">My Posts</Link><Link to="/bookmarks">Bookmarks</Link>
                    <Link to="/posts/create">+ New Post</Link>
                    <Link to={`/profile/${user.username || user._id}`}>{user.username}</Link>
                    <button onClick={handleLogout}>Logout</button>
                </> : <><Link to="/login">Login</Link><Link to="/register">Register</Link></>}
            </div>
        </nav>
    );
};
export default Navbar;
