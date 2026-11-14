import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiFetch from "../api/api";

const notificationText = item => {
    const name = item.sender?.fullName || item.sender?.username || "Someone";
    if (item.type === "FOLLOW") return `${name} followed you`;
    if (item.type === "LIKE") return `${name} liked your post`;
    if (item.type === "COMMENT") return `${name} commented on your post`;
    return "You have a new notification";
};

export default function Notifications() {
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/notifications");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Unable to load notifications");
            setItems(data.data.notifications || []); setUnread(data.data.unread || 0);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);
    const markRead = async id => {
        const res = await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
        if (res.ok) { setItems(old => old.map(item => item._id === id ? { ...item, isRead: true } : item)); setUnread(n => Math.max(0,n-1)); }
    };
    const markAll = async () => {
        const res = await apiFetch("/notifications/read-all", { method: "PATCH" });
        if (res.ok) { setItems(old => old.map(item => ({ ...item, isRead: true }))); setUnread(0); }
    };
    return <main style={{ maxWidth: 760, margin: "32px auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>Notifications {unread > 0 && <small>({unread} unread)</small>}</h1>
            <button onClick={markAll} disabled={!unread}>Mark all read</button>
        </div>
        {loading && <p>Loading...</p>}{error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        {!loading && !error && items.length === 0 && <p>No notifications yet.</p>}
        {items.map(item => <article key={item._id} style={{ padding: 14, borderBottom: "1px solid #ddd", background: item.isRead ? "#fff" : "#f3f7ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div><Link to={`/profile/${item.sender?.username || item.sender?._id}`}>{notificationText(item)}</Link>
                    <p style={{ color: "#777", fontSize: 12, margin: "6px 0" }}>{new Date(item.createdAt).toLocaleString()}</p>
                    {item.post && <Link to={`/posts/${item.post._id}`}>{item.post.title}</Link>}
                </div>
                {!item.isRead && <button onClick={() => markRead(item._id)}>Mark read</button>}
            </div>
        </article>)}
    </main>;
}
