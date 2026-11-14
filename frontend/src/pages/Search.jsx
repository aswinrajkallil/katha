import { useState } from "react";
import apiFetch from "../api/api";
import PostCard from "../components/Posts/PostCard";
import { Link } from "react-router-dom";

export default function Search() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState({ users: [], posts: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const submit = async e => {
        e.preventDefault();
        if (query.trim().length < 2) { setError("Enter at least 2 characters."); return; }
        setLoading(true); setError("");
        try {
            const res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Search failed");
            setResults({ users: data.data.users || [], posts: data.data.posts || [] });
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };
    return <main style={{ maxWidth: 820, margin: "32px auto", padding: 20 }}>
        <h1>Search Kathā</h1>
        <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search authors, stories and tags..." style={{ flex: 1, minWidth: 0, padding: 12 }} />
            <button disabled={loading}>{loading ? "Searching..." : "Search"}</button>
        </form>
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <h2>Authors</h2>
        {results.users.map(person => <div key={person._id} style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
            <Link to={`/profile/${person.username}`}><strong>{person.fullName || person.username}</strong> @{person.username}</Link>
            {person.bio && <p>{person.bio}</p>}
        </div>)}
        <h2>Stories</h2>
        {results.posts.map(post => <PostCard key={post._id} post={post} />)}
        {!loading && query && !results.users.length && !results.posts.length && <p>No results found.</p>}
    </main>;
}
