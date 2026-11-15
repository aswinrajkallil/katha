import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Type,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Tag,
  UploadCloud,
  X,
  Send,
  Eye,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import PostCard from "./PostCard";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import "./CreatePost.css";

const MAX_TITLE_LENGTH = 140;

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

export default function CreatePost() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("published");

  const [coverImage, setCoverImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewDate] = useState(() => new Date().toISOString());

  const fileInputRef = useRef(null);

  const isDirty = Boolean(
    title.trim() ||
    content.trim() ||
    excerpt.trim() ||
    videoUrl.trim() ||
    tags.trim() ||
    coverImage
  );

  const handleSaveDraft = async () => {
    const body = new FormData();
    body.append("title", title.trim() || "Untitled Draft");
    body.append("status", "draft");
    if (content.trim()) body.append("content", content.trim());
    if (excerpt.trim()) body.append("excerpt", excerpt.trim());
    if (videoUrl.trim()) body.append("videoUrl", videoUrl.trim());
    if (tags.trim()) {
      const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
      tagArray.forEach((t) => body.append("tags", t));
    }
    if (coverImage) body.append("coverImage", coverImage);

    try {
      const res = await apiFetch("/posts", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Draft saved successfully!");
        return true;
      } else {
        toast.error(data.message || "Failed to save draft");
        return false;
      }
    } catch {
      toast.error("Failed to save draft");
      return false;
    }
  };

  const { confirmDialogProps } = useUnsavedChanges({
    isDirty,
    onSaveDraft: handleSaveDraft,
  });

  const handleImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    setCoverImage(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const removeCoverImage = () => {
    setCoverImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title for your post");
      return;
    }

    setLoading(true);

    try {
      const body = new FormData();
      body.append("title", title.trim());
      body.append("status", status);
      if (content.trim()) body.append("content", content.trim());
      if (excerpt.trim()) body.append("excerpt", excerpt.trim());
      if (videoUrl.trim()) body.append("videoUrl", videoUrl.trim());
      if (tags.trim()) {
        const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
        tagArray.forEach((t) => body.append("tags", t));
      }
      if (coverImage) body.append("coverImage", coverImage);

      const res = await apiFetch("/posts", { method: "POST", body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.message || "Failed to create post");
        return;
      }

      toast.success(status === "draft" ? "Draft saved successfully!" : "Post published successfully!");
      navigate(`/post/${data.data._id}`);
    } catch (err) {
      toast.error(err.message === "SESSION_EXPIRED" ? "Session expired. Please log in." : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const youtubeEmbed = getYouTubeEmbedUrl(videoUrl);

  // Live preview post object
  const previewPost = {
    _id: "preview-temp-id",
    title: title.trim() || "Your Post Title Will Appear Here",
    excerpt: excerpt.trim() || (content.trim() ? content.trim().substring(0, 160) : "A short preview description of your story or thoughts will be displayed here in the feed..."),
    content: content.trim(),
    coverImage: imagePreviewUrl,
    videoUrl: videoUrl.trim(),
    createdAt: previewDate,
    views: 0,
    commentsCount: 0,
    status,
    author: {
      username: user?.username || "you",
      profileImage: user?.profileImage || null,
    },
  };

  return (
    <div className="create-post-container">
      <div className="create-post-layout">
        {/* Left Form Column */}
        <div className="create-post-form-col">
          <div className="create-post-header-row">
            <BackButton to="/" label="Back" />
            <div className="create-post-heading-wrap">
              <h1 className="create-post-title">Create a Post</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <Type size={16} color="#e8590c" />
                  <span>Title *</span>
                </span>
                <span className={`char-counter ${title.length > MAX_TITLE_LENGTH - 20 ? "limit-near" : ""}`}>
                  {title.length} / {MAX_TITLE_LENGTH}
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder="Give your story or video an engaging title..."
                required
                className="create-form-input"
              />
            </div>

            {/* Excerpt / Summary */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <FileText size={16} color="#e8590c" />
                  <span>Short Summary (Excerpt)</span>
                </span>
              </div>
              <input
                type="text"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief one-line overview that appears in the feed..."
                className="create-form-input"
              />
            </div>

            {/* Drag & Drop Cover Image */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <ImageIcon size={16} color="#e8590c" />
                  <span>Cover Image</span>
                </span>
                {coverImage && (
                  <button
                    type="button"
                    onClick={removeCoverImage}
                    style={{ background: "none", border: "none", color: "#dc2626", fontSize: "0.775rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    Remove image
                  </button>
                )}
              </div>

              {!imagePreviewUrl ? (
                <div
                  className={`dropzone-container ${dragActive ? "drag-active" : ""}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-content">
                    <span className="dropzone-icon-wrap">
                      <UploadCloud size={24} />
                    </span>
                    <p className="dropzone-text">
                      Drag and drop your image here, or <span style={{ color: "#e8590c", textDecoration: "underline" }}>browse</span>
                    </p>
                    <p className="dropzone-subtext">Supports PNG, JPG, WebP up to 10MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                    className="dropzone-file-input"
                  />
                </div>
              ) : (
                <div className="dropzone-preview-wrap">
                  <img src={imagePreviewUrl} alt="Cover preview" className="dropzone-preview-img" />
                  <button
                    type="button"
                    className="dropzone-remove-btn"
                    onClick={removeCoverImage}
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Optional Video URL */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <VideoIcon size={16} color="#e8590c" />
                  <span>Video URL (Optional)</span>
                </span>
              </div>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or direct video link"
                className="create-form-input"
              />
              {youtubeEmbed && (
                <div className="video-preview-mini">
                  <iframe
                    src={youtubeEmbed}
                    title="Video preview"
                    className="video-preview-iframe"
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            {/* Rich Content Body */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <FileText size={16} color="#e8590c" />
                  <span>Story Content</span>
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your story, ideas, analysis or notes..."
                rows={6}
                className="create-form-textarea"
              />
            </div>

            {/* Tags */}
            <div className="create-form-group">
              <div className="create-form-label">
                <span className="label-title-icon">
                  <Tag size={16} color="#e8590c" />
                  <span>Tags</span>
                </span>
              </div>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tech, stories, cinema (comma-separated)"
                className="create-form-input"
              />
            </div>

            {/* Status and Publish Bar */}
            <div className="create-post-actions-bar">
              <div className="status-toggle-wrap">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="create-form-select"
                  style={{ width: "auto", minWidth: 120, height: 42 }}
                >
                  <option value="published">Publish Now</option>
                  <option value="draft">Save as Draft</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="create-publish-btn"
              >
                {loading ? (
                  <span className="confirm-btn-spinner" />
                ) : (
                  <>
                    <Send size={16} />
                    <span>{status === "draft" ? "Save Draft" : "Publish"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Live Preview Column */}
        <div className="create-post-preview-col">
          <div className="preview-col-header">
            <span className="preview-badge">
              <Eye size={13} /> Live Reddit Preview
            </span>
            <span style={{ fontSize: "0.8rem", color: "#70757a" }}>
              How your post will appear in the feed
            </span>
          </div>

          <div className="preview-sticky-wrap">
            <PostCard post={previewPost} isPreview={true} />
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
