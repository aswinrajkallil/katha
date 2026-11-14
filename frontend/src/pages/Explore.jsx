import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";
import PostList from "../components/Posts/PostList";

export default function Explore() {
    const [trending, setTrending] = useState([]);
    const [authors, setAuthors] = useState([]);
    useEffect(() => {
        let active = true;
        Promise.all([apiFetch("/discover/trending"), apiFetch("/discover/authors")])
            .then(async ([postsRes, authorsRes]) => {
                const [postsData, authorsData] = await Promise.all([postsRes.json(), authorsRes.json()]);
                if (active && postsData.success) setTrending(postsData.data.posts || []);
                if (active && authorsData.success) setAuthors(authorsData.data || []);
            }).catch(() => {});
        return () => { active = false; };
    }, []);
    return <main style={{ maxWidth: 850, margin: "32px auto", padding: 20 }}>
        <h1>Explore Kathā</h1>
        <h2>Trending this week</h2>
        {trending.map(post => <PostCard key={post._id} post={post} />)}
        {trending.length === 0 && <p style={{ color: "#777" }}>No trending posts yet.</p>}
        <h2>Popular authors</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            {authors.map(author => <Link key={author._id} to={`/profile/${author.username}`} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <strong>{author.fullName || author.username}</strong><div>@{author.username}</div><small>{author.postCount} published posts</small>
            </Link>)}
        </div>
        <h2>All published posts</h2><PostList />
    </main>;
}
