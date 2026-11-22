import { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiFetch from "../api/api";

const AuthContext = createContext(null);

const normalizeUser = (userData) => {
    if (!userData) return null;
    const id = userData._id || userData.id;
    return { ...userData, _id: id, id };
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            apiFetch("/me")
                .then(async (res) => {
                    if (!res.ok) throw new Error("Unable to restore session");
                    return res.json();
                })
                .then((data) => {
                    if (data.success) {
                        setUser(normalizeUser(data.data));
                    } else {
                        localStorage.removeItem("accessToken");
                    }
                })
                .catch((error) => {
                    // Keep the stored token when the API is temporarily unreachable.
                    if (error.message === "SESSION_EXPIRED") {
                        localStorage.removeItem("accessToken");
                        setUser(null);
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = (accessToken, userData) => {
        localStorage.setItem("accessToken", accessToken);
        const normUser = normalizeUser(userData);
        setUser(normUser);
        try {
            const uid = normUser?._id || normUser?.id || "guest";
            localStorage.removeItem(`katha_welcome_seen_${uid}`);
        } catch {
            // Ignore storage errors
        }
    };

    const logout = async () => {
        try {
            await apiFetch("/logout", { method: "POST", credentials: "include" });
        } catch (_) {
            // Clear the local session even if the server is unreachable.
        }
        localStorage.removeItem("accessToken");
        setUser(null);
    };

    const updateUser = (updatedData) => {
        setUser((prev) => normalizeUser({ ...prev, ...updatedData }));
    };

    // Re-read the account from the server. Roles are enforced by the API on every request;
    // this keeps the UI in step when a role is changed or revoked while a session is open.
    const refreshUser = useCallback(async () => {
        if (!localStorage.getItem("accessToken")) return;
        try {
            const res = await apiFetch("/me");
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) setUser(normalizeUser(data.data));
        } catch {
            // Offline or expired: keep the current state.
        }
    }, []);

    const role = user?.role;
    useEffect(() => {
        if (!role || role === "user") return undefined;
        const onVisible = () => {
            if (document.visibilityState === "visible") refreshUser();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [role, refreshUser]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};

export default AuthContext;
