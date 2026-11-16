import React from "react";
import { mediaUrl } from "../utils/media";

// Generates consistent soft background color from username
const getFallbackColor = (name) => {
  if (!name) return { bg: "#ffedd5", text: "#e8590c" };
  const palette = [
    { bg: "#ffedd5", text: "#e8590c" }, // Orange (Kathā brand)
    { bg: "#e0f2fe", text: "#0284c7" }, // Sky
    { bg: "#dcfce7", text: "#16a34a" }, // Emerald
    { bg: "#f3e8ff", text: "#9333ea" }, // Purple
    { bg: "#fee2e2", text: "#dc2626" }, // Rose
    { bg: "#fef3c7", text: "#d97706" }, // Amber
    { bg: "#ccfbf1", text: "#0d9488" }, // Teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

export default function UserAvatar({ user, profileImage, username, size = 28, className = "" }) {
  const img = profileImage || user?.profileImage;
  const name = username || user?.username || user?.fullName || "User";
  const initial = (name[0] || "U").toUpperCase();
  const url = img ? mediaUrl(img, { w: size * 2, h: size * 2, fit: "fill" }) : null;
  const colors = getFallbackColor(name);

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: "50%",
    fontSize: `${Math.max(10, Math.round(size * 0.42))}px`,
  };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`user-avatar-img ${className}`.trim()}
        loading="lazy"
        decoding="async"
        style={{
          ...style,
          objectFit: "cover",
          display: "block",
        }}
        onError={(e) => {
          // If image fails to load, replace with initial
          e.currentTarget.style.display = "none";
          if (e.currentTarget.nextElementSibling) {
            e.currentTarget.nextElementSibling.style.display = "flex";
          }
        }}
      />
    );
  }

  return (
    <div
      className={`user-avatar-fallback ${className}`.trim()}
      style={{
        ...style,
        backgroundColor: colors.bg,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        userSelect: "none",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
