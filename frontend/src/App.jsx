import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import PostDetails from "./components/Posts/PostDetails";
import CreatePost from "./components/Posts/CreatePost";
import EditPost from "./components/Posts/EditPost";
import Profile from "./components/Profile/Profile";
import EditProfile from "./components/Profile/EditProfile";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import MyPosts from "./pages/MyPosts";
import Bookmarks from "./pages/Bookmarks";
import FollowingFeed from "./pages/FollowingFeed";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import Connections from "./pages/Connections";
import NotFound from "./pages/NotFound";

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

function AppRoutes() {
    return <>
        <Navbar />
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/search" element={<Search />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/profile/:id/:relation" element={<Connections />} />
            <Route path="/posts/:id" element={<PostDetails />} />
            <Route path="/posts/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
            <Route path="/posts/:id/edit" element={<ProtectedRoute><EditPost /></ProtectedRoute>} />
            <Route path="/my-posts" element={<ProtectedRoute><MyPosts /></ProtectedRoute>} />
            <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
            <Route path="/feed/following" element={<ProtectedRoute><FollowingFeed /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    </>;
}

export default function App() {
    return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
