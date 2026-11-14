import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiFetch from "../../api/api";

const Login = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Login failed");
                return;
            }

            login(data.data.accessToken, data.data.user);
            navigate("/");
        } catch (e) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: "60px auto", padding: 24 }}>
            <h2>Login to Kathā</h2>
            <form onSubmit={handleSubmit}>
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
                <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>
            <p style={{ marginTop: 16 }}>
                Don&apos;t have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
};

export default Login;
