import { isStaff, hasPermission, homeFor } from "./pages/Admin/adminAccess";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
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
const DeletedPosts = lazy(() => import("./pages/DeletedPosts"));
const FollowingFeed = lazy(() => import("./pages/FollowingFeed"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Connections = lazy(() => import("./pages/Connections"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin lazy routes (fully code-split from public app bundle)
const AdminLogin = lazy(() => import("./pages/Admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/Admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/Admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/Admin/AdminUserDetail"));
const AdminPosts = lazy(() => import("./pages/Admin/AdminPosts"));
const AdminComments = lazy(() => import("./pages/Admin/AdminComments"));
const AdminReports = lazy(() => import("./pages/Admin/AdminReports"));
const AdminCategories = lazy(() => import("./pages/Admin/AdminCategories"));
const AdminFeatured = lazy(() => import("./pages/Admin/AdminFeatured"));
const AdminAnalytics = lazy(() => import("./pages/Admin/AdminAnalytics"));
const AdminManagement = lazy(() => import("./pages/Admin/AdminManagement"));
const AdminActivity = lazy(() => import("./pages/Admin/AdminActivity"));
const AdminSettings = lazy(() => import("./pages/Admin/AdminSettings"));

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

// Any staff role may enter the console; each page additionally requires its own permission.
// The API enforces all of this again on every request.
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <PageLoader />;
    if (!user || !isStaff(user.role)) return <Navigate to="/admin/login" replace />;
    return children;
};

const AdminPage = ({ permission, children }) => {
    const { user } = useAuth();
    if (!hasPermission(user?.role, permission)) {
        return <Navigate to={homeFor(user?.role)} replace />;
    }
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

                {/* Admin Routes: Isolated from public layout and lazy loaded */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<AdminPage permission="dashboard:view"><AdminDashboard /></AdminPage>} />
                    <Route path="users" element={<AdminPage permission="users:view"><AdminUsers /></AdminPage>} />
                    <Route path="users/:id" element={<AdminPage permission="users:view"><AdminUserDetail /></AdminPage>} />
                    <Route path="posts" element={<AdminPage permission="posts:view"><AdminPosts /></AdminPage>} />
                    <Route path="comments" element={<AdminPage permission="comments:view"><AdminComments /></AdminPage>} />
                    <Route path="reports" element={<AdminPage permission="reports:view"><AdminReports /></AdminPage>} />
                    <Route path="categories" element={<AdminPage permission="categories:manage"><AdminCategories /></AdminPage>} />
                    <Route path="featured" element={<AdminPage permission="featured:manage"><AdminFeatured /></AdminPage>} />
                    <Route path="analytics" element={<AdminPage permission="analytics:view"><AdminAnalytics /></AdminPage>} />
                    <Route path="management" element={<AdminPage permission="roles:manage"><AdminManagement /></AdminPage>} />
                    <Route path="activity" element={<AdminPage permission="audit:view"><AdminActivity /></AdminPage>} />
                    <Route path="settings" element={<AdminPage permission="settings:manage"><AdminSettings /></AdminPage>} />
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
                    <Route path="/deleted-posts" element={<ProtectedRoute><DeletedPosts /></ProtectedRoute>} />
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
                <SocketProvider>
                    <ToastProvider>
                        <NavigationGuardProvider>
                            <AppRoutes />
                        </NavigationGuardProvider>
                    </ToastProvider>
                </SocketProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
