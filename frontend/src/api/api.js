const API_URL = import.meta.env.VITE_API_URL;

let refreshPromise = null;

const refreshAccessToken = async () => {
    if (!refreshPromise) {
        refreshPromise = fetch(`${API_URL}/api/refresh`, {
            method: "POST",
            credentials: "include"
        })
            .then(async (response) => {
                // Only delete the stored accessToken when the server actually rejects the refresh (401/403)
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem("accessToken");
                    throw new Error("SESSION_EXPIRED");
                }
                if (!response.ok) {
                    // Cold start or server transient error - preserve existing token
                    throw new Error("REFRESH_FAILED");
                }

                const data = await response.json().catch(() => ({}));
                const token = data.data?.accessToken || data.accessToken;

                if (!token) {
                    localStorage.removeItem("accessToken");
                    throw new Error("SESSION_EXPIRED");
                }

                localStorage.setItem("accessToken", token);
                return token;
            })
            .catch((error) => {
                // Never clear accessToken on network errors or cold starts
                throw error;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

/**
 * Shared API client.
 * Attaches the access token and retries one time after a coordinated refresh.
 */
const apiFetch = async (path, options = {}) => {
    const sendRequest = (token) => {
        const headers = new Headers(options.headers || {});

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        if (
            !(options.body instanceof FormData) &&
            !headers.has("Content-Type") &&
            options.body
        ) {
            headers.set("Content-Type", "application/json");
        }

        return fetch(`${API_URL}/api${path}`, {
            ...options,
            credentials: "include",
            headers,
            signal: options.signal
        });
    };

    const isAuthEndpoint = ["/login", "/register", "/refresh", "/logout"].includes(path);
    const accessToken = localStorage.getItem("accessToken");
    let response = await sendRequest(accessToken);

    if (response.status !== 401 || isAuthEndpoint) {
        return response;
    }

    // Another request may already have refreshed the token while this request was in flight.
    const latestToken = localStorage.getItem("accessToken");
    const newAccessToken = latestToken && latestToken !== accessToken
        ? latestToken
        : await refreshAccessToken();
    response = await sendRequest(newAccessToken);
    return response;
};

/**
 * Fetcher helper for react-query queries:
 * Passes AbortSignal and throws on non-OK responses with the server error message.
 */
export const apiQuery = async (path, options = {}) => {
    const res = await apiFetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        const err = new Error(data.message || `Request failed (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data.data !== undefined ? data.data : data;
};

export default apiFetch;
