import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../api/api";

const CreatePost = () => {
    const [formData, setFormData] = useState({
        title: "",
        content: "",
        excerpt: "",
        type: "blog",
        videoUrl: "",
        tags: "",
        status: "draft"
    });
    const [coverImage, setCoverImage] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

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

            const res = await apiFetch("/posts", { method: "POST", body });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Failed to create post");
                return;
            }

            navigate(`/posts/${data.data._id}`);
        } catch (e) {
            setError(e.message === "SESSION_EXPIRED" ? "Session expired. Please log in." : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
            <h2>Create New Post</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                    <label>Post Type *</label><br />
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
                        placeholder="Post title"
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label>Excerpt (short summary)</label><br />
                    <input
                        type="text"
                        name="excerpt"
                        value={formData.excerpt}
                        onChange={handleChange}
                        placeholder="Short description..."
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
                            placeholder="Write your blog post here..."
                            rows={12}
                            required={formData.type === "blog"}
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
                            placeholder="https://youtube.com/watch?v=..."
                            required={formData.type === "video"}
                            style={{ width: "100%", padding: 8, marginTop: 4 }}
                        />
                    </div>
                )}

                <div style={{ marginBottom: 16 }}>
                    <label>Cover Image</label><br />
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
                        placeholder="react, javascript, web"
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
                    <button type="submit" disabled={loading} style={{ padding: "10px 24px" }}>
                        {loading ? "Creating..." : "Create Post"}
                    </button>
                    <button type="button" onClick={() => navigate(-1)} style={{ padding: "10px 24px" }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePost;
