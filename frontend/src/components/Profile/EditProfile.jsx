import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";

const EditProfile = () => {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: "", bio: "" });
    const [profileImage, setProfileImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (user) {
            setFormData({ username: user.username || "", bio: user.bio || "" });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const body = new FormData();
            body.append("username", formData.username);
            body.append("bio", formData.bio);
            if (profileImage) body.append("profileImage", profileImage);

            const res = await apiFetch("/users/profile", { method: "PUT", body });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Failed to update profile");
                return;
            }

            updateUser(data.data);
            setSuccess("Profile updated successfully!");
            setTimeout(() => navigate(`/profile/${user._id}`), 1000);
        } catch (e) {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 500, margin: "40px auto", padding: 24 }}>
            <h2>Edit Profile</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                    <label>Username</label><br />
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label>Bio</label><br />
                    <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Tell readers about yourself..."
                        style={{ width: "100%", padding: 8, marginTop: 4, fontFamily: "inherit" }}
                    />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label>Profile Image</label><br />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfileImage(e.target.files[0])}
                        style={{ marginTop: 4 }}
                    />
                </div>
                {error && <p style={{ color: "red" }}>{error}</p>}
                {success && <p style={{ color: "green" }}>{success}</p>}
                <button type="submit" disabled={loading} style={{ padding: "10px 24px" }}>
                    {loading ? "Saving..." : "Save Profile"}
                </button>
            </form>
        </div>
    );
};

export default EditProfile;
