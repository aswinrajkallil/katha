import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { NavigationGuardProvider } from "./context/NavigationGuardContext";
import Layout from "./components/Layout";
import AuthLayout from "./components/Auth/AuthLayout";

// React.lazy route splitting
const Login = lazy(() => import("./components/Auth/Login"));
const Register = lazy(() => import("./components/Auth/Register"));
const PostDetails = lazy(() => import("./components/Posts/PostDetails"));
const CreatePost = lazy(() => import("./components/Posts/CreatePost"));
const EditPost = lazy(() => import("./components/Posts/EditPost"));
const Profile = lazy(() => import("./components/Profile/Profile"));
const EditProfile = lazy(() => import("./components/Profile/EditProfile"));
const Home = lazy(() => import("./pages/Home"));
const Explore = lazy(() => import("./pages/Explore"));
const MyPosts = lazy(() => import("./pages/MyPosts"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const FollowingFeed = lazy(() => import("./pages/FollowingFeed"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Connections = lazy(() => import("./pages/Connections"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div style={{ padding: "48px 24px", textAlign: "center", color: "#70757a" }}>
    <div className="skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 8, margin: "0 auto" }} />
  </div>
);

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <PageLoader />;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Standalone Auth Routes: No main app chrome (no sidebar, no header, no bottom bar) */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                </Route>

                {/* Main Application Routes */}
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/profile/:id" element={<Profile />} />
                    <Route path="/profile/:id/:relation" element={<Connections />} />
                    <Route path="/posts/:id" element={<PostDetails />} />
                    <Route path="/post/:id" element={<PostDetails />} />
                    <Route path="/posts/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
                    <Route path="/posts/:id/edit" element={<ProtectedRoute><EditPost /></ProtectedRoute>} />
                    <Route path="/my-posts" element={<ProtectedRoute><MyPosts /></ProtectedRoute>} />
                    <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
                    <Route path="/feed/following" element={<ProtectedRoute><FollowingFeed /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </Suspense>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <NavigationGuardProvider>
                        <AppRoutes />
                    </NavigationGuardProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
