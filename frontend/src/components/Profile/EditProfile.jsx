import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import {
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  X,
  Upload,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import apiFetch from "../../api/api";
import BackButton from "../BackButton";
import ConfirmDialog from "../ConfirmDialog";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { mediaUrl } from "../../utils/media";
import { getCroppedImg } from "../../utils/cropImage";
import "./EditProfile.css";

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Form state
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    bio: "",
    location: "",
    website: "",
  });

  const [initialForm, setInitialForm] = useState(null);

  // Images state
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);

  // Drag states
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [avatarDragActive, setAvatarDragActive] = useState(false);

  // Crop Modal state
  // cropTarget: 'avatar' | 'cover' | null
  const [cropTarget, setCropTarget] = useState(null);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropProcessing, setCropProcessing] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({
    state: "idle", // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Populate initial values
  useEffect(() => {
    if (!user) return;
    const initial = {
      username: user.username || "",
      fullName: user.fullName || "",
      bio: user.bio || "",
      location: user.location || "",
      website: user.website || "",
    };
    setForm(initial);
    setInitialForm(initial);

    if (user.profileImage) {
      setAvatarPreview(mediaUrl(user.profileImage, { w: 320, h: 320, fit: "fill" }));
    }
    if (user.coverImage) {
      setCoverPreview(mediaUrl(user.coverImage, { w: 1600, h: 533, fit: "fill" }));
    }
  }, [user]);

  // Compute dirty state
  const isDirty = Boolean(
    initialForm &&
      (form.username !== initialForm.username ||
        form.fullName !== initialForm.fullName ||
        form.bio !== initialForm.bio ||
        form.location !== initialForm.location ||
        form.website !== initialForm.website ||
        avatarFile !== null ||
        coverFile !== null ||
        removeAvatar ||
        removeCover)
  );

  const { confirmDialogProps, triggerBack } = useUnsavedChanges({
    isDirty,
    onSaveDraft: null, // Edit profile doesn't save drafts
  });

  // Debounced username check
  const checkUsernameAvailability = useCallback(
    (name) => {
      const trimmed = name.trim().toLowerCase();
      if (!trimmed) {
        setUsernameStatus({ state: "invalid", message: "Username is required" });
        return;
      }
      if (!/^[a-z0-9_.]{3,30}$/.test(trimmed)) {
        setUsernameStatus({
          state: "invalid",
          message: "3–30 chars using lowercase letters, numbers, underscores or dots",
        });
        return;
      }
      // If same as current user username, it's valid
      if (user && trimmed === user.username?.toLowerCase()) {
        setUsernameStatus({ state: "idle", message: "" });
        return;
      }

      setUsernameStatus({ state: "checking", message: "Checking availability..." });

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await apiFetch(`/check-username?username=${encodeURIComponent(trimmed)}`);
          const data = await res.json();
          if (data.available) {
            setUsernameStatus({ state: "available", message: "Username is available!" });
          } else {
            setUsernameStatus({ state: "taken", message: "Username is already taken" });
          }
        } catch {
          setUsernameStatus({ state: "idle", message: "" });
        }
      }, 350);
    },
    [user]
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "username") {
      checkUsernameAvailability(value);
    }
  };

  // File selection for cropping
  const handleSelectRawImage = (file, target) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, GIF)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setCropTarget(target);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "cover") setCoverDragActive(true);
    if (target === "avatar") setAvatarDragActive(true);
  };

  const handleDragLeave = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "cover") setCoverDragActive(false);
    if (target === "avatar") setAvatarDragActive(false);
  };

  const handleDrop = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "cover") setCoverDragActive(false);
    if (target === "avatar") setAvatarDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleSelectRawImage(file, target);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!rawImageSrc || !croppedAreaPixels || !cropTarget) return;

    setCropProcessing(true);
    try {
      if (cropTarget === "avatar") {
        const { file, previewUrl } = await getCroppedImg(
          rawImageSrc,
          croppedAreaPixels,
          512,
          512,
          0.85,
          "avatar.webp"
        );
        setAvatarFile(file);
        setAvatarPreview(previewUrl);
        setRemoveAvatar(false);
        toast.success("Profile photo cropped!");
      } else if (cropTarget === "cover") {
        const { file, previewUrl } = await getCroppedImg(
          rawImageSrc,
          croppedAreaPixels,
          1600,
          533,
          0.85,
          "cover.webp"
        );
        setCoverFile(file);
        setCoverPreview(previewUrl);
        setRemoveCover(false);
        toast.success("Cover banner cropped!");
      }
      setCropTarget(null);
      setRawImageSrc(null);
    } catch (err) {
      console.error("Crop error:", err);
      toast.error("Failed to crop image. Please try again.");
    } finally {
      setCropProcessing(false);
    }
  };

  const handleRemovePhoto = (target) => {
    if (target === "avatar") {
      setAvatarFile(null);
      setAvatarPreview("");
      setRemoveAvatar(true);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    } else if (target === "cover") {
      setCoverFile(null);
      setCoverPreview("");
      setRemoveCover(true);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleDiscard = () => {
    if (initialForm) {
      setForm(initialForm);
      setAvatarFile(null);
      setCoverFile(null);
      setRemoveAvatar(false);
      setRemoveCover(false);
      setAvatarPreview(
        user?.profileImage ? mediaUrl(user.profileImage, { w: 320, h: 320, fit: "fill" }) : ""
      );
      setCoverPreview(
        user?.coverImage ? mediaUrl(user.coverImage, { w: 1600, h: 533, fit: "fill" }) : ""
      );
      setUsernameStatus({ state: "idle", message: "" });
      toast.info("Changes reverted");
    }
  };

  // Submit profile changes in a single request
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (usernameStatus.state === "taken" || usernameStatus.state === "invalid") {
      toast.error(usernameStatus.message || "Please fix the username before saving");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const body = new FormData();
      body.append("username", form.username.trim().toLowerCase());
      body.append("fullName", form.fullName.trim());
      body.append("bio", form.bio.trim());
      body.append("location", form.location.trim());
      body.append("website", form.website.trim());

      if (avatarFile) {
        body.append("profileImage", avatarFile);
      } else if (removeAvatar) {
        body.append("removeProfileImage", "true");
      }

      if (coverFile) {
        body.append("coverImage", coverFile);
      } else if (removeCover) {
        body.append("removeCoverImage", "true");
      }

      const res = await apiFetch("/users/profile", {
        method: "PUT",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || `Unable to update profile (${res.status})`);
      }

      // Instantly update user context and navbar avatar
      updateUser(data.data);
      toast.success("Profile updated successfully!");
      navigate(`/profile/${data.data.username}`);
    } catch (err) {
      setError(err.message || "Unable to update profile");
      toast.error(err.message || "Unable to update profile");
    } finally {
      setLoading(false);
    }
  };

  const initialLetter = (form.username || user?.username || "?")[0].toUpperCase();

  return (
    <main className="edit-profile-page">
      <BackButton onClick={triggerBack} />

      <h1 className="edit-profile-heading">Edit Profile</h1>

      {/* Live Preview Header Card */}
      <section className="edit-profile-preview-card" aria-label="Profile visuals preview">
        {/* Cover Dropzone */}
        <div
          className={`edit-cover-dropzone ${coverDragActive ? "drag-active" : ""}`}
          onClick={() => coverInputRef.current?.click()}
          onDragOver={(e) => handleDragOver(e, "cover")}
          onDragLeave={(e) => handleDragLeave(e, "cover")}
          onDrop={(e) => handleDrop(e, "cover")}
          role="button"
          tabIndex={0}
          aria-label="Upload cover image"
        >
          {coverPreview && !removeCover ? (
            <img src={coverPreview} alt="" className="edit-cover-image" />
          ) : null}

          <div className="edit-cover-overlay">
            <Camera size={18} />
            <span>Click or drag to change cover</span>
          </div>

          {coverPreview && !removeCover && (
            <button
              type="button"
              className="edit-cover-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePhoto("cover");
              }}
              aria-label="Remove cover image"
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          )}

          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSelectRawImage(e.target.files[0], "cover");
            }}
            style={{ display: "none" }}
          />
        </div>

        {/* Avatar Section */}
        <div className="edit-avatar-section">
          <div
            className={`edit-avatar-wrapper ${avatarDragActive ? "drag-active" : ""}`}
            onClick={() => avatarInputRef.current?.click()}
            onDragOver={(e) => handleDragOver(e, "avatar")}
            onDragLeave={(e) => handleDragLeave(e, "avatar")}
            onDrop={(e) => handleDrop(e, "avatar")}
            role="button"
            tabIndex={0}
            aria-label="Upload profile photo"
          >
            {avatarPreview && !removeAvatar ? (
              <img src={avatarPreview} alt="Profile" className="edit-avatar-image" />
            ) : (
              <div className="edit-avatar-fallback">{initialLetter}</div>
            )}

            <div className="edit-avatar-overlay">
              <Camera size={18} />
              <span>Change</span>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                if (e.target.files?.[0]) handleSelectRawImage(e.target.files[0], "avatar");
              }}
              style={{ display: "none" }}
            />
          </div>

          {/* Avatar Actions */}
          <div className="edit-avatar-actions">
            <button
              type="button"
              className="edit-photo-btn"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Upload size={14} />
              <span>Upload photo</span>
            </button>
            {avatarPreview && !removeAvatar && (
              <button
                type="button"
                className="edit-photo-btn danger"
                onClick={() => handleRemovePhoto("avatar")}
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Form with Floating Labels */}
      <form onSubmit={handleSubmit} className="edit-profile-form">
        {/* Full Name */}
        <div className="floating-group">
          <div className="floating-input-wrapper">
            <input
              id="fullName"
              name="fullName"
              className="floating-input"
              placeholder=" "
              value={form.fullName}
              onChange={handleInputChange}
              maxLength={80}
            />
            <label htmlFor="fullName" className="floating-label">
              Full Name
            </label>
          </div>
          <div className="floating-meta-row">
            <span className="floating-status-msg info">Your display name</span>
            <span className="floating-char-counter">{form.fullName.length}/80</span>
          </div>
        </div>

        {/* Username */}
        <div className="floating-group">
          <div className="floating-input-wrapper">
            <input
              id="username"
              name="username"
              className={`floating-input ${
                usernameStatus.state === "taken" || usernameStatus.state === "invalid"
                  ? "has-error"
                  : ""
              }`}
              placeholder=" "
              value={form.username}
              onChange={handleInputChange}
              required
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <label htmlFor="username" className="floating-label">
              Username *
            </label>
          </div>
          <div className="floating-meta-row">
            <span
              className={`floating-status-msg ${
                usernameStatus.state === "available"
                  ? "success"
                  : usernameStatus.state === "taken" || usernameStatus.state === "invalid"
                  ? "error"
                  : "info"
              }`}
            >
              {usernameStatus.state === "checking" && <Loader2 size={13} className="spin" />}
              {usernameStatus.state === "available" && <CheckCircle2 size={13} />}
              {(usernameStatus.state === "taken" || usernameStatus.state === "invalid") && (
                <AlertCircle size={13} />
              )}
              <span>{usernameStatus.message || "3–30 chars (letters, numbers, underscores, dots)"}</span>
            </span>
            <span className="floating-char-counter">{form.username.length}/30</span>
          </div>
        </div>

        {/* Bio */}
        <div className="floating-group">
          <div className="floating-input-wrapper">
            <textarea
              id="bio"
              name="bio"
              className="floating-textarea"
              placeholder=" "
              value={form.bio}
              onChange={handleInputChange}
              maxLength={300}
              rows={4}
            />
            <label htmlFor="bio" className="floating-label">
              Bio
            </label>
          </div>
          <div className="floating-meta-row">
            <span className="floating-status-msg info">Tell the community about yourself</span>
            <span className="floating-char-counter">{form.bio.length}/300</span>
          </div>
        </div>

        {/* Location */}
        <div className="floating-group">
          <div className="floating-input-wrapper">
            <input
              id="location"
              name="location"
              className="floating-input"
              placeholder=" "
              value={form.location}
              onChange={handleInputChange}
              maxLength={100}
            />
            <label htmlFor="location" className="floating-label">
              Location
            </label>
          </div>
          <div className="floating-meta-row">
            <span className="floating-status-msg info">City, country, or remote</span>
            <span className="floating-char-counter">{form.location.length}/100</span>
          </div>
        </div>

        {/* Website */}
        <div className="floating-group">
          <div className="floating-input-wrapper">
            <input
              id="website"
              name="website"
              type="url"
              className="floating-input"
              placeholder=" "
              value={form.website}
              onChange={handleInputChange}
              maxLength={200}
            />
            <label htmlFor="website" className="floating-label">
              Website (https://...)
            </label>
          </div>
          <div className="floating-meta-row">
            <span className="floating-status-msg info">Personal blog, portfolio, or profile</span>
            <span className="floating-char-counter">{form.website.length}/200</span>
          </div>
        </div>

        {error && (
          <div className="floating-status-msg error" role="alert" style={{ fontSize: "0.9rem" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Sticky Bottom Save Bar */}
        <div className="edit-profile-save-bar">
          <div className="edit-save-bar-info">
            {isDirty && <span className="edit-dirty-dot" />}
            <span>{isDirty ? "You have unsaved changes" : "All changes saved"}</span>
          </div>

          <div className="edit-save-actions">
            <button
              type="button"
              className="edit-cancel-btn"
              onClick={handleDiscard}
              disabled={!isDirty || loading}
            >
              Reset
            </button>
            <button
              type="submit"
              className="edit-submit-btn"
              disabled={!isDirty || loading || usernameStatus.state === "taken" || usernameStatus.state === "invalid"}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* In-Browser Crop Modal */}
      {cropTarget && rawImageSrc && (
        <div className="crop-modal-backdrop" role="dialog" aria-modal="true" aria-label="Crop image">
          <div className="crop-modal-card">
            <div className="crop-modal-header">
              <h2 className="crop-modal-title">
                {cropTarget === "avatar" ? "Crop Profile Photo (1:1)" : "Crop Cover Banner (3:1)"}
              </h2>
              <button
                type="button"
                className="crop-modal-close-btn"
                onClick={() => {
                  setCropTarget(null);
                  setRawImageSrc(null);
                }}
                aria-label="Cancel crop"
              >
                <X size={20} />
              </button>
            </div>

            <div className="crop-area-container">
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropTarget === "avatar" ? 1 : 3 / 1}
                cropShape={cropTarget === "avatar" ? "round" : "rect"}
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="crop-controls">
              <div className="crop-zoom-slider-row">
                <ZoomOut size={16} />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  aria-label="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="crop-zoom-slider"
                />
                <ZoomIn size={16} />
              </div>

              <div className="crop-modal-actions">
                <button
                  type="button"
                  className="edit-cancel-btn"
                  onClick={() => {
                    setCropTarget(null);
                    setRawImageSrc(null);
                  }}
                  disabled={cropProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="edit-submit-btn"
                  onClick={handleApplyCrop}
                  disabled={cropProcessing}
                >
                  {cropProcessing ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Apply Crop</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes confirmation dialog */}
      <ConfirmDialog {...confirmDialogProps} />
    </main>
  );
}
