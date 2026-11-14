import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";
import PostList from "../Posts/PostList";

const Profile = () => {
    const { id } = useParams();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [followers, setFollowers] = useState(0);
    const [following, setFollowing] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const isOwnProfile = currentUser && currentUser._id === id;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await apiFetch(`/users/${id}`);
                const data = await res.json();
                if (data.success) {
                    setProfile(data.data);
                } else {
                    setError(data.message || "User not found");
                }
            } catch (e) {
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };

        const fetchFollowData = async () => {
            try {
                const [followerRes, followingRes] = await Promise.all([
                    apiFetch(`/users/${id}/followers`),
                    apiFetch(`/users/${id}/following`)
                ]);
                const followerData = await followerRes.json();
                const followingData = await followingRes.json();
                if (followerData.success) {
                    setFollowers(followerData.data.count);
                    if (currentUser) {
                        setIsFollowing(
                            followerData.data.followers.some((f) => f._id === currentUser._id)
                        );
                    }
                }
                if (followingData.success) setFollowing(followingData.data.count);
            } catch (_) {}
        };

        fetchProfile();
        fetchFollowData();
    }, [id, currentUser]);

    const handleFollow = async () => {
        if (!currentUser) return;
        setFollowLoading(true);
        try {
            const method = isFollowing ? "DELETE" : "POST";
            const res = await apiFetch(`/users/${id}/follow`, { method });
            const data = await res.json();
            if (data.success) {
                setIsFollowing(!isFollowing);
                setFollowers((prev) => isFollowing ? prev - 1 : prev + 1);
            }
        } catch (_) {}
        setFollowLoading(false);
    };

    if (loading) return <p style={{ padding: 24 }}>Loading profile...</p>;
    if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;

    return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
                {profile.profileImage ? (
                    <img
                        src={`${import.meta.env.VITE_API_URL}${profile.profileImage}`}
                        alt={profile.username}
                        style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }}
                    />
                ) : (
                    <div style={{
                        width: 80, height: 80, borderRadius: "50%",
                        background: "#ddd", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 32
                    }}>
                        {profile.username?.[0]?.toUpperCase()}
                    </div>
                )}
                <div>
                    <h2 style={{ margin: 0 }}>{profile.username}</h2>
                    {profile.bio && <p style={{ color: "#666", marginTop: 4 }}>{profile.bio}</p>}
                    <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 14 }}>
                        <span><strong>{followers}</strong> Followers</span>
                        <span><strong>{following}</strong> Following</span>
                    </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                    {isOwnProfile ? (
                        <Link to="/profile/edit"><button style={{ padding: "8px 16px" }}>Edit Profile</button></Link>
                    ) : currentUser && (
                        <button
                            onClick={handleFollow}
                            disabled={followLoading}
                            style={{
                                padding: "8px 16px",
                                background: isFollowing ? "#eee" : "#000",
                                color: isFollowing ? "#000" : "#fff",
                                border: "1px solid #ccc",
                                cursor: "pointer",
                                borderRadius: 4
                            }}
                        >
                            {isFollowing ? "Unfollow" : "Follow"}
                        </button>
                    )}
                </div>
            </div>

            <h3>Posts by {profile.username}</h3>
            <PostList authorId={id} />
        </div>
    );
};

export default Profile;
