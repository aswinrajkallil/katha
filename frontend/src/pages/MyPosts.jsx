import { Link } from "react-router-dom";
import PostList from "../components/Posts/PostList";
import { useAuth } from "../context/AuthContext";

const MyPosts = () => {
    const { user } = useAuth();

    if (!user) {
        return (
            <div style={{ padding: 40, textAlign: "center" }}>
                <p>Please <Link to="/login">log in</Link> to view your posts.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1>My Posts</h1>
                <Link to="/posts/create"><button
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#fff7ed",
                            color: "#ea580c",
                            border: "1px solid #fdba74",
                            borderRadius: "999px",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                        >
                        + New Post
                        </button></Link>
            </div>
            <PostList myPosts={true} />
        </div>
    );
};

export default MyPosts;
