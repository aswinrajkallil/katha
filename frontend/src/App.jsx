import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";

// Auth
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";

// Posts
import PostDetails from "./components/Posts/PostDetails";
import CreatePost from "./components/Posts/CreatePost";
import EditPost from "./components/Posts/EditPost";

// Profile
import Profile from "./components/Profile/Profile";
import EditProfile from "./components/Profile/EditProfile";

// Pages
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import MyPosts from "./pages/MyPosts";
import Bookmarks from "./pages/Bookmarks";
import NotFound from "./pages/NotFound";

// Protected route: redirect to /login if not authenticated
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

function AppRoutes() {
    return (
        <>
            <Navbar />
            <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile/:id" element={<Profile />} />

                {/* Protected — specific routes BEFORE parameterized :id */}
                <Route path="/posts/create" element={
                    <ProtectedRoute><CreatePost /></ProtectedRoute>
                } />
                <Route path="/posts/:id/edit" element={
                    <ProtectedRoute><EditPost /></ProtectedRoute>
                } />
                <Route path="/posts/:id" element={<PostDetails />} />
                <Route path="/my-posts" element={
                    <ProtectedRoute><MyPosts /></ProtectedRoute>
                } />
                <Route path="/bookmarks" element={
                    <ProtectedRoute><Bookmarks /></ProtectedRoute>
                } />
                <Route path="/profile/edit" element={
                    <ProtectedRoute><EditProfile /></ProtectedRoute>
                } />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
