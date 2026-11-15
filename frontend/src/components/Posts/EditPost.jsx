import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Type, FileText, Image as ImageIcon, Video as VideoIcon, Tag, Send } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import BackButton from "../BackButton";
import "./CreatePost.css";

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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
            videoUrl: p.videoUrl || "",
            tags: p.tags?.join(", ") || "",
            status: p.status || "draft",
          });
        } else {
          setError(data.message || "Post not found");
        }
      } catch {
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
      body.append("title", formData.title.trim());
      body.append("status", formData.status);
      if (formData.content.trim()) body.append("content", formData.content.trim());
      if (formData.excerpt.trim()) body.append("excerpt", formData.excerpt.trim());
      if (formData.videoUrl.trim()) body.append("videoUrl", formData.videoUrl.trim());
      if (formData.tags) {
        const tagArray = formData.tags.split(",").map((t) => t.trim()).filter(Boolean);
        tagArray.forEach((t) => body.append("tags", t));
      }
      if (coverImage) body.append("coverImage", coverImage);

      const res = await apiFetch(`/posts/${id}`, { method: "PUT", body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.message || "Failed to update post");
        return;
      }

      toast.success("Post updated successfully!");
      navigate(`/post/${id}`);
    } catch {
      toast.error("Something went wrong while updating");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 24, textAlign: "center" }}>
        <p style={{ color: "#70757a" }}>Loading post...</p>
      </div>
    );
  }

  if (error && !formData) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 24, textAlign: "center" }}>
        <BackButton />
        <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "32px auto 64px auto", padding: "0 20px" }}>
      <BackButton to={`/post/${id}`} label="Back" />
      <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 16, padding: "28px 32px", marginTop: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
        <h1 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0 0 20px 0", color: "#111827" }}>
          Edit Post
        </h1>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <Type size={16} color="#e8590c" />
                <span>Title *</span>
              </span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="create-form-input"
            />
          </div>

          {/* Excerpt */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <FileText size={16} color="#e8590c" />
                <span>Short Summary (Excerpt)</span>
              </span>
            </label>
            <input
              type="text"
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              className="create-form-input"
            />
          </div>

          {/* Video URL */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <VideoIcon size={16} color="#e8590c" />
                <span>Video URL (Optional)</span>
              </span>
            </label>
            <input
              type="url"
              name="videoUrl"
              value={formData.videoUrl}
              onChange={handleChange}
              placeholder="https://youtube.com/watch?v=..."
              className="create-form-input"
            />
          </div>

          {/* Content */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <FileText size={16} color="#e8590c" />
                <span>Content</span>
              </span>
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows={8}
              className="create-form-textarea"
            />
          </div>

          {/* Replace Cover Image */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <ImageIcon size={16} color="#e8590c" />
                <span>Update Cover Image</span>
              </span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0])}
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          {/* Tags */}
          <div className="create-form-group">
            <label className="create-form-label">
              <span className="label-title-icon">
                <Tag size={16} color="#e8590c" />
                <span>Tags</span>
              </span>
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="create-form-input"
            />
          </div>

          {/* Status */}
          <div className="create-form-group">
            <label className="create-form-label">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="create-form-select"
              style={{ width: "auto", minWidth: 140 }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              type="submit"
              disabled={saving}
              className="create-publish-btn"
            >
              {saving ? <span className="confirm-btn-spinner" /> : <><Send size={16} /> <span>Save Changes</span></>}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{ padding: "10px 20px", borderRadius: 999, border: "1px solid #d1d5db", background: "transparent", color: "#374151", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
