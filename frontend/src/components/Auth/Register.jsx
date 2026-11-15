import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiFetch from "../../api/api";
import logoFull from "../../assets/katha-logo-full.svg";

const Register = () => {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const response = await apiFetch("/register", {
                method: "POST",
                body: JSON.stringify(formData)
            });

            const responseText = await response.text();
            let data = {};
            try {
                data = responseText ? JSON.parse(responseText) : {};
            } catch {
                throw new Error(`Server returned an invalid response (HTTP ${response.status})`);
            }

            if (!response.ok) {
                setError(data.message || "Registration failed");
                return;
            }

            setSuccess("Account created! Redirecting to login...");
            setTimeout(() => navigate("/login"), 1500);
        } catch (e) {
            console.error("Registration request failed:", e);
            setError(e.message === "Failed to fetch"
                ? "Cannot reach the server. Check that the backend is running and VITE_API_URL is correct."
                : e.message || "Registration failed. Check the browser console and backend terminal.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: "60px auto", padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <Link to="/">
                    <img src={logoFull} alt="Kathā" style={{ height: 40, width: "auto" }} />
                </Link>
            </div>
            <h2>Create a Kathā Account</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <label>Username</label><br />
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="yourname"
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Email</label><br />
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Password</label><br />
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                </div>
                {error && <p style={{ color: "red" }}>{error}</p>}
                {success && <p style={{ color: "green" }}>{success}</p>}
                <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
                    {loading ? "Creating account..." : "Register"}
                </button>
            </form>
            <p style={{ marginTop: 16 }}>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
};

export default Register;
