import { createContext, useContext, useState, useEffect } from "react";
import apiFetch from "../api/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On mount, try to fetch current user using stored token
    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            apiFetch("/me")
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setUser(data.data);
                    } else {
                        localStorage.removeItem("accessToken");
                    }
                })
                .catch(() => {
                    localStorage.removeItem("accessToken");
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = (accessToken, userData) => {
        localStorage.setItem("accessToken", accessToken);
        setUser(userData);
    };

    const logout = async () => {
        try {
            await apiFetch("/logout", { method: "POST", credentials: "include" });
        } catch (_) {
            // ignore errors on logout
        }
        localStorage.removeItem("accessToken");
        setUser(null);
    };

    const updateUser = (updatedData) => {
        setUser((prev) => ({ ...prev, ...updatedData }));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
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
