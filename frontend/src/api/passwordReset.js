import apiFetch from "./api";

const NETWORK_MESSAGE =
  "Unable to connect to the server. Please check your internet connection and try again.";

// Both calls resolve with the server's message and throw an Error whose message is safe to show.
const post = async (path, body) => {
  let res;
  try {
    res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  } catch {
    throw new Error(NETWORK_MESSAGE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data.message;
};

export const requestPasswordReset = (email) =>
  post("/forgot-password", { email: email.trim() });

export const completePasswordReset = (token, password) =>
  post(`/reset-password/${encodeURIComponent(token)}`, { password });
