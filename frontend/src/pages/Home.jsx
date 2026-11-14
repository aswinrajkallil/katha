import PostList from "../components/Posts/PostList";

const Home = () => {
    return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
            <h1>Welcome to Kathā</h1>
            <p style={{ color: "#666", marginBottom: 32 }}>
                A space for stories, ideas, and videos.
            </p>
            <PostList />
        </div>
    );
};

export default Home;
