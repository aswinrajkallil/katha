const API_URL = import.meta.env.VITE_API_URL;

/**
 * Shared API client for Kathā.
 * - Automatically attaches Authorization header with access token
 * - Retries once after refreshing the token on 401
 * - Throws on session expiry so components can redirect to login
 */
const apiFetch = async (path, options = {}) => {
    const sendRequest = (token) => {
        const headers = new Headers(options.headers || {});

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        // Don't set Content-Type for FormData — browser sets it with boundary
        if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body) {
            headers.set("Content-Type", "application/json");
        }

        return fetch(`${API_URL}/api${path}`, {
            ...options,
            credentials: "include", // Always send cookies for refresh token
            headers
        });
    };

    let accessToken = localStorage.getItem("accessToken");
    let response = await sendRequest(accessToken);

    // If not a 401, return as-is
    if (response.status !== 401) {
        return response;
    }

    // Try refreshing the access token
    const refreshResponse = await fetch(`${API_URL}/api/refresh`, {
        method: "POST",
        credentials: "include"
    });

    if (!refreshResponse.ok) {
        localStorage.removeItem("accessToken");
        throw new Error("SESSION_EXPIRED");
    }

    const data = await refreshResponse.json();
    accessToken = data.data?.accessToken || data.accessToken;

    if (!accessToken) {
        localStorage.removeItem("accessToken");
        throw new Error("SESSION_EXPIRED");
    }

    localStorage.setItem("accessToken", accessToken);

    // Retry the original request with the new token
    response = await sendRequest(accessToken);
    return response;
};

export default apiFetch;
