import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";

export default function EditProfile() {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", fullName: "", bio: "", location: "", website: "" });
    const [image, setImage] = useState(null);
    const [cover, setCover] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;
        setForm({ username: user.username || "", fullName: user.fullName || "", bio: user.bio || "", location: user.location || "", website: user.website || "" });
    }, [user]);

    const change = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const submit = async e => {
        e.preventDefault(); setError(""); setLoading(true);
        try {
            const body = new FormData();
            Object.entries(form).forEach(([key, value]) => body.append(key, value));
            if (image) body.append("profileImage", image);
            const res = await apiFetch("/users/profile", { method: "PUT", body });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Unable to update profile");
            updateUser(data.data);
            if (cover) {
                const coverBody = new FormData();
                coverBody.append("coverImage", cover);
                const coverRes = await apiFetch("/users/profile/cover", { method: "PUT", body: coverBody });
                const coverData = await coverRes.json();
                if (!coverRes.ok || !coverData.success) throw new Error(coverData.message || "Profile saved, but cover image upload failed");
                updateUser(coverData.data);
            }
            navigate(`/profile/${data.data.username}`);
        } catch (err) { setError(err.message || "Unable to update profile"); }
        finally { setLoading(false); }
    };

    return <main style={{ maxWidth: 620, margin: "36px auto", padding: 24 }}>
        <h1>Edit your profile</h1>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            {[["username","Username"],["fullName","Full name"],["location","Location"],["website","Website"]].map(([name,label]) =>
                <label key={name}>{label}<input name={name} value={form[name]} onChange={change} required={name === "username"} style={{ display: "block", boxSizing: "border-box", width: "100%", padding: 10, marginTop: 5 }} /></label>)}
            <label>Bio<textarea name="bio" value={form.bio} onChange={change} maxLength={300} rows={4} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 10, marginTop: 5 }} /><small>{form.bio.length}/300</small></label>
            <label>Profile picture<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const file=e.target.files?.[0]; setImage(file || null); setPreview(file ? URL.createObjectURL(file) : ""); }} /></label>
            <label>Cover image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
            {preview && <img src={preview} alt="New profile preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: "50%" }} />}
            {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}><button disabled={loading}>{loading ? "Saving..." : "Save changes"}</button><button type="button" onClick={() => navigate(-1)}>Cancel</button></div>
        </form>
    </main>;
}
