import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiFetch from "../../api/api";

const EditPost = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState(null);
    const [coverImage, setCoverImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const res = await apiFetch(`/posts/${id}`);
                const data = await res.json();
                if (data.success) {
                    const p = data.data;
                    setFormData({
                        title: p.title || "",
                        content: p.content || "",
                        excerpt: p.excerpt || "",
                        type: p.type || "blog",
                        videoUrl: p.videoUrl || "",
                        tags: p.tags?.join(", ") || "",
                        status: p.status || "draft"
                    });
                } else {
                    setError(data.message || "Post not found");
                }
            } catch (e) {
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            const body = new FormData();
            body.append("title", formData.title);
            body.append("type", formData.type);
            body.append("status", formData.status);
            if (formData.content) body.append("content", formData.content);
            if (formData.excerpt) body.append("excerpt", formData.excerpt);
            if (formData.videoUrl) body.append("videoUrl", formData.videoUrl);
            if (formData.tags) {
                const tagArray = formData.tags.split(",").map((t) => t.trim()).filter(Boolean);
                tagArray.forEach((tag) => body.append("tags", tag));
            }
            if (coverImage) body.append("coverImage", coverImage);

            const res = await apiFetch(`/posts/${id}`, { method: "PUT", body });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Failed to update post");
                return;
            }

            navigate(`/posts/${id}`);
        } catch (e) {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ padding: 24 }}>Loading post...</p>;
    if (error && !formData) return <p style={{ padding: 24, color: "red" }}>{error}</p>;

    return (
        <div style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
            <h2>Edit Post</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                    <label>Post Type</label><br />
                    <select name="type" value={formData.type} onChange={handleChange} style={{ padding: 8, marginTop: 4 }}>
                        <option value="blog">Blog Post</option>
                        <option value="video">Video Post</option>
                    </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label>Title *</label><br />
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label>Excerpt</label><br />
                    <input
                        type="text"
                        name="excerpt"
                        value={formData.excerpt}
                        onChange={handleChange}
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                {formData.type === "blog" && (
                    <div style={{ marginBottom: 16 }}>
                        <label>Content *</label><br />
                        <textarea
                            name="content"
                            value={formData.content}
                            onChange={handleChange}
                            rows={12}
                            style={{ width: "100%", padding: 8, marginTop: 4, fontFamily: "inherit" }}
                        />
                    </div>
                )}

                {formData.type === "video" && (
                    <div style={{ marginBottom: 16 }}>
                        <label>Video URL *</label><br />
                        <input
                            type="url"
                            name="videoUrl"
                            value={formData.videoUrl}
                            onChange={handleChange}
                            style={{ width: "100%", padding: 8, marginTop: 4 }}
                        />
                    </div>
                )}

                <div style={{ marginBottom: 16 }}>
                    <label>Replace Cover Image</label><br />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCoverImage(e.target.files[0])}
                        style={{ marginTop: 4 }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label>Tags (comma-separated)</label><br />
                    <input
                        type="text"
                        name="tags"
                        value={formData.tags}
                        onChange={handleChange}
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label>Status</label><br />
                    <select name="status" value={formData.status} onChange={handleChange} style={{ padding: 8, marginTop: 4 }}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                    </select>
                </div>

                {error && <p style={{ color: "red" }}>{error}</p>}

                <div style={{ display: "flex", gap: 12 }}>
                    <button type="submit" disabled={saving} style={{ padding: "10px 24px" }}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" onClick={() => navigate(-1)} style={{ padding: "10px 24px" }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditPost;
