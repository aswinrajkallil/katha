import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";
import PostList from "../Posts/PostList";
import BackButton from "../BackButton";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Profile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true); setError("");
        apiFetch(`/users/${encodeURIComponent(id)}`)
            .then(async res => {
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Profile not found");
                if (active) setProfile(data.data);
            })
            .catch(err => { if (active) setError(err.message || "Unable to load profile"); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    const handleFollow = async () => {
        if (!currentUser) return;
        setBusy(true);
        try {
            const method = profile.isFollowing ? "DELETE" : "POST";
            const res = await apiFetch(`/users/${profile._id}/follow`, { method });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Follow action failed");
            setProfile(prev => ({ ...prev, isFollowing: method === "POST",
                stats: { ...prev.stats, followers: data.data?.followers ?? prev.stats.followers + (method === "POST" ? 1 : -1) } }));
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };

    const handleLogout = async () => {
        setShowLogoutDialog(false);
        await logout();
        navigate("/login");
    };

    // Close dialog on Esc
    useEffect(() => {
        if (!showLogoutDialog) return;
        const esc = (e) => e.key === "Escape" && setShowLogoutDialog(false);
        document.addEventListener("keydown", esc);
        return () => document.removeEventListener("keydown", esc);
    }, [showLogoutDialog]);

    if (loading) return <p style={{ padding: 24 }}>Loading profile...</p>;
    if (error && !profile) return <p role="alert" style={{ padding: 24 }}>{error}</p>;
    if (!profile) return null;
    const own = profile.isOwnProfile || currentUser?._id === profile._id;

    return <main style={{ maxWidth: 900, margin: "32px auto", padding: 20 }}>
        <BackButton />
        <section style={{ border: "1px solid #ddd", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
            <div style={{ height: 180, background: "#eee", backgroundImage: profile.coverImage ? `url(${API_URL}${profile.coverImage})` : "linear-gradient(120deg,#202938,#64748b)", backgroundSize: "cover", backgroundPosition: "center" }} />
            <div style={{ padding: 22 }}>
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                    {profile.profileImage ? <img src={`${API_URL}${profile.profileImage}`} alt="" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: "4px solid white", marginTop: -58, background: "#fff" }} /> :
                        <div style={{ width: 100, height: 100, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 36, background: "#ddd", marginTop: -58 }}>{(profile.username || "?")[0].toUpperCase()}</div>}
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <h1 style={{ margin: "0 0 4px" }}>{profile.fullName || profile.username}</h1>
                        <p style={{ margin: 0, color: "#777" }}>@{profile.username}</p>
                    </div>
                    {own ? (
                        <div style={{ display: "flex", gap: 8 }}>
                            <Link to="/profile/edit"><button className="btn-primary">Edit profile</button></Link>
                            <button className="btn-danger" onClick={() => setShowLogoutDialog(true)}>Log out</button>
                        </div>
                    ) :
                        currentUser && <button className="btn-primary" disabled={busy} onClick={handleFollow}>{busy ? "Please wait..." : profile.isFollowing ? "Following · Unfollow" : "Follow"}</button>}
                </div>
                {profile.bio && <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{profile.bio}</p>}
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "#555" }}>
                    <span><strong>{profile.stats?.posts ?? 0}</strong> posts</span>
                    <Link to={`/profile/${profile._id}/followers`}><strong>{profile.stats?.followers ?? 0}</strong> followers</Link>
                    <Link to={`/profile/${profile._id}/following`}><strong>{profile.stats?.following ?? 0}</strong> following</Link>
                    {profile.location && <span>{profile.location}</span>}
                    {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">Website</a>}
                </div>
            </div>
        </section>
        <h2>Published posts</h2>
        <PostList authorId={profile.username || profile._id} />

        {/* ---- Logout confirmation dialog ---- */}
        {showLogoutDialog && (
            <div
                style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.4)",
                }}
                onClick={() => setShowLogoutDialog(false)}
            >
                <div
                    style={{
                        background: "#fff", borderRadius: 12, padding: "28px 32px",
                        width: 340, maxWidth: "90vw",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="logout-title"
                >
                    <h3 id="logout-title" style={{ margin: "0 0 16px", fontSize: "1.05rem" }}>
                        Are you sure you want to log out?
                    </h3>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button
                            onClick={() => setShowLogoutDialog(false)}
                            style={{
                                background: "#e5e7eb", color: "#374151",
                                border: "none", borderRadius: 6,
                                padding: "0.45rem 1rem", cursor: "pointer",
                                fontSize: "0.875rem", fontWeight: 500,
                            }}
                        >
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={handleLogout}>
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        )}
    </main>;
}
