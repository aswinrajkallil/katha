import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Globe,
  Calendar,
  MoreHorizontal,
  Pencil,
  Share2,
  LogOut,
  UserPlus,
  UserCheck,
  LayoutList,
  Grid3X3,
  Bookmark,
  FileText,
  Maximize2,
  X,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSocket, useUserRoom } from "../../context/SocketContext";
import apiFetch, { apiQuery } from "../../api/api";
import { queryKeys, patchFollowState } from "../../api/queryClient";
import PostList from "../Posts/PostList";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import { mediaUrl } from "../../utils/media";
import "./Profile.css";

const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toLocaleString();
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

const cleanUrl = (rawUrl) => {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./, "") + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return rawUrl;
  }
};

const ProfileSkeleton = () => (
  <div className="profile-skeleton-card" aria-hidden="true">
    <div className="profile-skeleton-cover skeleton-shimmer" />
    <div className="profile-skeleton-avatar skeleton-shimmer" />
    <div className="profile-skeleton-body">
      <div className="profile-skeleton-line profile-skeleton-title skeleton-shimmer" />
      <div className="profile-skeleton-line profile-skeleton-meta skeleton-shimmer" />
      <div className="profile-skeleton-line profile-skeleton-bio skeleton-shimmer" />
      <div className="profile-skeleton-stats">
        <div className="profile-skeleton-line profile-skeleton-stat-pill skeleton-shimmer" />
        <div className="profile-skeleton-line profile-skeleton-stat-pill skeleton-shimmer" />
        <div className="profile-skeleton-line profile-skeleton-stat-pill skeleton-shimmer" />
      </div>
    </div>
  </div>
);

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'bookmarks'
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // { src, alt }
  const [followBusy, setFollowBusy] = useState(false);

  const menuRef = useRef(null);

  // React Query for profile server state
  const {
    data: profile,
    isLoading: loading,
    error: profileError,
    refetch: fetchProfile,
  } = useQuery({
    // Follow status belongs to the viewer, so separate cache entries by signed-in user.
    queryKey: [...queryKeys.profile(id), currentUser?._id || currentUser?.id || "guest"],
    queryFn: () => apiQuery(`/users/${encodeURIComponent(id)}`),
    staleTime: 60 * 1000,
  });

  const error = profileError ? profileError.message : "";

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxImage) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [lightboxImage]);

  const { socket } = useSocket();
  useUserRoom(profile?._id);

  // Realtime updates for profile room
  useEffect(() => {
    if (!socket || !profile?._id) return;

    const onFollowChanged = (data) => {
      if (data.targetUserId === profile._id) {
        queryClient.setQueriesData({ queryKey: queryKeys.profile(id) }, (old) => {
          if (!old) return old;
          return {
            ...old,
            isFollowing:
              String(data.actorId) === String(currentUser?._id || currentUser?.id || "")
                ? Boolean(data.isFollowing)
                : old.isFollowing,
            stats: {
              ...old.stats,
              followers: data.followersCount,
            },
          };
        });
      }
    };

    const onProfileUpdated = (data) => {
      if (data.userId === profile._id) {
        queryClient.setQueriesData({ queryKey: queryKeys.profile(id) }, (old) => {
          if (!old) return old;
          return {
            ...old,
            ...data.profile,
          };
        });
      }
    };

    socket.on("follow:changed", onFollowChanged);
    socket.on("profile:updated", onProfileUpdated);

    return () => {
      socket.off("follow:changed", onFollowChanged);
      socket.off("profile:updated", onProfileUpdated);
    };
  }, [socket, profile?._id, id, queryClient, currentUser?._id, currentUser?.id]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (followBusy || !profile) return;

    const previousState = {
      isFollowing: profile.isFollowing,
      followers: profile.stats?.followers ?? 0,
    };

    const nextIsFollowing = !previousState.isFollowing;
    const nextFollowersCount = Math.max(0, previousState.followers + (nextIsFollowing ? 1 : -1));

    // Optimistic cache update in react-query
    patchFollowState(queryClient, profile._id, nextIsFollowing, nextFollowersCount);

    setFollowBusy(true);

    try {
      const method = nextIsFollowing ? "POST" : "DELETE";
      const res = await apiFetch(`/users/${profile._id}/follow`, { method });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success !== true) {
        throw new Error(data.message || `Follow request failed (${res.status})`);
      }

      patchFollowState(
        queryClient,
        profile._id,
        nextIsFollowing,
        data.data?.followers
      );

      // Refresh every server-backed view that depends on the relationship.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.suggestions() }),
        queryClient.invalidateQueries({ queryKey: ["connections"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarPosts() }),
      ]);

      toast.success(
        nextIsFollowing
          ? `You are now following @${profile.username}`
          : `Unfollowed @${profile.username}`
      );
    } catch (err) {
      // Rollback on error
      patchFollowState(
        queryClient,
        profile._id,
        previousState.isFollowing,
        previousState.followers
      );
      toast.error(err.message || "Network error. Please try again.");
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCopyProfileLink = () => {
    setMenuOpen(false);
    navigator.clipboard?.writeText?.(window.location.href);
    toast.success("Profile link copied to clipboard!");
  };

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <main className="profile-page">
        <BackButton />
        <ProfileSkeleton />
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="profile-page">
        <BackButton />
        <div className="profile-error-card" role="alert">
          <div className="profile-error-icon">
            <AlertCircle size={28} />
          </div>
          <h2 className="profile-error-title">Profile Unavailable</h2>
          <p className="profile-error-desc">{error}</p>
          <button type="button" className="profile-btn profile-btn-follow" onClick={fetchProfile}>
            <RotateCcw size={16} /> Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const isOwnProfile = profile.isOwnProfile || currentUser?._id === profile._id;
  const coverUrl = profile.coverImage
    ? mediaUrl(profile.coverImage, { w: 1600, h: 533, fit: "fill" })
    : null;
  const avatarUrl = profile.profileImage
    ? mediaUrl(profile.profileImage, { w: 320, h: 320, fit: "fill" })
    : null;
  const initial = (profile.username || "?")[0].toUpperCase();
  const joinedDate = formatDate(profile.createdAt);
  const websiteDisplay = cleanUrl(profile.website);
  const websiteHref = profile.website?.startsWith("http")
    ? profile.website
    : `https://${profile.website}`;

  return (
    <main className="profile-page">
      <BackButton />

      {/* Profile Header Card */}
      <section className="profile-header-card" aria-label="User profile">
        {/* Cover Banner */}
        <div
          className="profile-cover-banner"
          onClick={() => {
            if (profile.coverImage) {
              setLightboxImage({
                src: mediaUrl(profile.coverImage, { w: 2000 }),
                alt: `${profile.fullName || profile.username}'s cover banner`,
              });
            }
          }}
          role={profile.coverImage ? "button" : undefined}
          tabIndex={profile.coverImage ? 0 : undefined}
          aria-label={profile.coverImage ? "View cover image" : undefined}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              className="profile-cover-img"
              loading="lazy"
              decoding="async"
            />
          )}
          {coverUrl && (
            <div className="profile-cover-overlay">
              <Maximize2 size={16} />
              <span>View cover</span>
            </div>
          )}
        </div>

        {/* Profile Info Body */}
        <div className="profile-info-body">
          {/* Avatar & Actions Row */}
          <div className="profile-avatar-row">
            <div
              className="profile-avatar-wrapper"
              onClick={() => {
                if (profile.profileImage) {
                  setLightboxImage({
                    src: mediaUrl(profile.profileImage, { w: 1000 }),
                    alt: `${profile.fullName || profile.username}'s profile picture`,
                  });
                }
              }}
              role={profile.profileImage ? "button" : undefined}
              tabIndex={profile.profileImage ? 0 : undefined}
              aria-label={profile.profileImage ? "View profile photo" : undefined}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile.fullName || profile.username}
                  className="profile-avatar-img"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="profile-avatar-fallback" aria-hidden="true">
                  {initial}
                </div>
              )}
              {avatarUrl && (
                <div className="profile-avatar-overlay">
                  <Maximize2 size={20} />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="profile-actions">
              {isOwnProfile ? (
                <>
                  <Link to="/profile/edit" className="profile-btn profile-btn-edit">
                    <Pencil size={15} />
                    <span>Edit profile</span>
                  </Link>

                  <div className="profile-overflow-wrapper" ref={menuRef}>
                    <button
                      type="button"
                      className="profile-btn-overflow"
                      onClick={() => setMenuOpen(!menuOpen)}
                      aria-label="More options"
                      aria-expanded={menuOpen}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {menuOpen && (
                      <div className="profile-overflow-menu" role="menu">
                        <Link
                          to="/profile/edit"
                          className="profile-overflow-item"
                          onClick={() => setMenuOpen(false)}
                          role="menuitem"
                        >
                          <Pencil size={15} />
                          <span>Edit profile</span>
                        </Link>
                        <button
                          type="button"
                          className="profile-overflow-item"
                          onClick={handleCopyProfileLink}
                          role="menuitem"
                        >
                          <Share2 size={15} />
                          <span>Share profile</span>
                        </button>
                        <div className="profile-overflow-divider" />
                        <button
                          type="button"
                          className="profile-overflow-item danger"
                          onClick={() => {
                            setMenuOpen(false);
                            setShowLogoutDialog(true);
                          }}
                          role="menuitem"
                        >
                          <LogOut size={15} />
                          <span>Log out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={`profile-btn ${
                    profile.isFollowing ? "profile-btn-following" : "profile-btn-follow"
                  }`}
                  onClick={handleFollowToggle}
                  disabled={followBusy}
                  aria-pressed={profile.isFollowing}
                >
                  {profile.isFollowing ? (
                    <>
                      <UserCheck size={16} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* User Identity */}
          <div className="profile-identity">
            <div className="profile-name-row">
              <h1 className="profile-full-name">{profile.fullName || profile.username}</h1>
              <span className="profile-username">@{profile.username}</span>
            </div>

            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            <div className="profile-meta-list">
              {profile.location && (
                <div className="profile-meta-item">
                  <MapPin size={15} />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <div className="profile-meta-item">
                  <Globe size={15} />
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-meta-link"
                  >
                    {websiteDisplay}
                  </a>
                </div>
              )}
              {joinedDate && (
                <div className="profile-meta-item">
                  <Calendar size={15} />
                  <span>Joined {joinedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Instagram-style Stats Row */}
          <div className="profile-stats-row">
            <div className="profile-stat-item static">
              <span className="profile-stat-count">{formatNumber(profile.stats?.posts ?? 0)}</span>
              <span className="profile-stat-label">posts</span>
            </div>

            <Link
              to={`/profile/${profile.username || profile._id}/followers`}
              className="profile-stat-item"
            >
              <span className="profile-stat-count">
                {formatNumber(profile.stats?.followers ?? 0)}
              </span>
              <span className="profile-stat-label">followers</span>
            </Link>

            <Link
              to={`/profile/${profile.username || profile._id}/following`}
              className="profile-stat-item"
            >
              <span className="profile-stat-count">
                {formatNumber(profile.stats?.following ?? 0)}
              </span>
              <span className="profile-stat-label">following</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky Tab Bar & View Mode Toggle */}
      <div className="profile-tabs-bar">
        <div className="profile-tabs-left" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "posts"}
            className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <FileText size={16} />
            <span>Stories</span>
          </button>

          {isOwnProfile && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "bookmarks"}
              className={`profile-tab-btn ${activeTab === "bookmarks" ? "active" : ""}`}
              onClick={() => setActiveTab("bookmarks")}
            >
              <Bookmark size={16} />
              <span>Bookmarks</span>
            </button>
          )}
        </div>

        {/* List / Grid Toggle */}
        <div className="profile-view-toggle" role="group" aria-label="Post layout">
          <button
            type="button"
            className={`profile-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-label="List view"
            title="List view"
          >
            <LayoutList size={16} />
          </button>
          <button
            type="button"
            className={`profile-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            title="Grid view"
          >
            <Grid3X3 size={16} />
          </button>
        </div>
      </div>

      {/* Tab Content: Posts or Bookmarks */}
      {activeTab === "posts" ? (
        <PostList
          key={`posts-${profile.username || profile._id}-${viewMode}`}
          authorId={profile.username || profile._id}
          viewMode={viewMode}
        />
      ) : (
        <PostList
          key={`bookmarks-${viewMode}`}
          bookmarks={true}
          viewMode={viewMode}
        />
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="profile-lightbox-backdrop"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div
            className="profile-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="profile-lightbox-close"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt || "Preview"}
              className="profile-lightbox-img"
            />
          </div>
        </div>
      )}

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        isOpen={showLogoutDialog}
        title="Log out of Kathā?"
        message="You will need to enter your credentials again to access your account."
        confirmText="Log Out"
        cancelText="Stay logged in"
        onConfirm={handleLogout}
        onClose={() => setShowLogoutDialog(false)}
        danger={true}
      />
    </main>
  );
}
