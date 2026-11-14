const API_URL = import.meta.env.VITE_API_URL;

let refreshPromise = null;

const refreshAccessToken = async () => {
    if (!refreshPromise) {
        refreshPromise = fetch(`${API_URL}/api/refresh`, {
            method: "POST",
            credentials: "include"
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("SESSION_EXPIRED");
                }

                const data = await response.json();
                const token = data.data?.accessToken || data.accessToken;

                if (!token) {
                    throw new Error("SESSION_EXPIRED");
                }

                localStorage.setItem("accessToken", token);
                return token;
            })
            .catch((error) => {
                localStorage.removeItem("accessToken");
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
            headers
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

export default apiFetch;
