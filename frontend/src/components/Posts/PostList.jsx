import { useCallback, useEffect, useMemo, useState } from "react";
import PostCard from "./PostCard";
import apiFetch from "../../api/api";

const dateOptions = [["", "All time"], ["7days", "Last 7 days"], ["30days", "Last 30 days"], ["3months", "Last 3 months"], ["6months", "Last 6 months"], ["thisYear", "This year"]];
const sortOptions = [["latest", "Latest first"], ["oldest", "Oldest first"], ["mostViewed", "Most viewed"], ["mostLiked", "Most liked"]];

const PostList = ({ authorId, showDrafts = false, myPosts = false }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [category, setCategory] = useState("");
    const [tagsInput, setTagsInput] = useState("");
    const [tags, setTags] = useState([]);
    const [dateRange, setDateRange] = useState("");
    const [sort, setSort] = useState("latest");
    const [categories, setCategories] = useState([]);
    const canFilter = !myPosts && !authorId;

    useEffect(() => {
        if (!canFilter) return;
        let active = true;
        apiFetch("/categories").then(response => response.json()).then(data => {
            if (active && data.success) setCategories(data.data || []);
        }).catch(() => { if (active) setCategories([]); });
        return () => { active = false; };
    }, [canFilter]);

    useEffect(() => {
        if (!canFilter) return;
        const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
        return () => clearTimeout(timer);
    }, [searchInput, canFilter]);

    const queryString = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (canFilter) {
            if (search) params.set("search", search);
            if (type) params.set("type", type);
            if (category) params.set("category", category);
            if (tags.length) params.set("tags", tags.join(","));
            if (dateRange) params.set("dateRange", dateRange);
            params.set("sort", sort);
        }
        return params.toString();
    }, [page, canFilter, search, type, category, tags, dateRange, sort]);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const path = myPosts ? "/posts/my" : authorId ? `/users/${encodeURIComponent(authorId)}/posts` : "/posts";
            const response = await apiFetch(`${path}?${queryString}`);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to load posts");
            setPosts(data.data.posts || []);
            setPagination(data.data.pagination || null);
        } catch (err) {
            setError(err.message === "SESSION_EXPIRED" ? "Your session has expired. Please sign in again." : (err.message || "Failed to load posts"));
        } finally { setLoading(false); }
    }, [myPosts, authorId, queryString]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const applyTags = () => {
        setTags([...new Set(tagsInput.split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 10));
        setPage(1);
    };

    const clearFilters = () => {
        setSearchInput(""); setSearch(""); setType(""); setCategory("");
        setTagsInput(""); setTags([]); setDateRange(""); setSort("latest"); setPage(1);
    };

    const activeFilters = [
        ...(search ? [{ label: `Search: ${search}`, clear: () => { setSearch(""); setSearchInput(""); } }] : []),
        ...(type ? [{ label: type === "blog" ? "Blogs" : "Videos", clear: () => setType("") }] : []),
        ...(category ? [{ label: categories.find(item => item._id === category)?.name || "Category", clear: () => setCategory("") }] : []),
        ...tags.map(tag => ({ label: `#${tag}`, clear: () => setTags(current => current.filter(item => item !== tag)) })),
        ...(dateRange ? [{ label: dateOptions.find(item => item[0] === dateRange)?.[1] || dateRange, clear: () => setDateRange("") }] : []),
        ...(sort !== "latest" ? [{ label: sortOptions.find(item => item[0] === sort)?.[1] || sort, clear: () => setSort("latest") }] : [])
    ];

    return (
        <div>
            {canFilter && <section style={{ marginBottom: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
                <label htmlFor="post-search" style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Search Kathā</label>
                <input id="post-search" type="search" placeholder="Search titles, content, tags, categories or authors..."
                    value={searchInput} onChange={event => setSearchInput(event.target.value)}
                    style={{ boxSizing: "border-box", width: "100%", padding: 11, marginBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
                    <select aria-label="Category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} style={{ padding: 10 }}>
                        <option value="">All categories</option>
                        {categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                    <select aria-label="Post type" value={type} onChange={event => { setType(event.target.value); setPage(1); }} style={{ padding: 10 }}>
                        <option value="">All post types</option><option value="blog">Blogs</option><option value="video">Videos</option>
                    </select>
                    <select aria-label="Date published" value={dateRange} onChange={event => { setDateRange(event.target.value); setPage(1); }} style={{ padding: 10 }}>
                        {dateOptions.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}
                    </select>
                    <select aria-label="Sort posts" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }} style={{ padding: 10 }}>
                        {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </div>
                <form onSubmit={event => { event.preventDefault(); applyTags(); }} style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input aria-label="Filter by tags" value={tagsInput} onChange={event => setTagsInput(event.target.value)}
                        placeholder="Filter tags (comma separated)" style={{ minWidth: 0, flex: 1, padding: 10 }} />
                    <button type="submit">Add tags</button>
                </form>
                {activeFilters.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
                    {activeFilters.map((filter, index) => <button key={`${filter.label}-${index}`} type="button"
                        onClick={() => { filter.clear(); setPage(1); }}
                        style={{ border: "1px solid #bbb", borderRadius: 20, padding: "5px 10px", cursor: "pointer" }}>{filter.label} ×</button>)}
                    <button type="button" onClick={clearFilters}>Clear all</button>
                </div>}
                {pagination && <p style={{ margin: "12px 0 0", color: "#777" }}>{pagination.total} matching posts</p>}
            </section>}
            {loading && <p>Loading posts...</p>}
            {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
            {!loading && !error && posts.length === 0 && <p style={{ color: "#888" }}>
                {myPosts ? "You haven't created any posts yet." : "No posts match these filters. Try changing your search or clearing filters."}
            </p>}
            {posts.map(post => <PostCard key={post._id} post={post} onDelete={deletedId => setPosts(current => current.filter(item => item._id !== deletedId))} />)}
            {pagination && pagination.totalPages > 1 && <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 16 }}>
                <button disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>← Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button disabled={page >= pagination.totalPages || loading} onClick={() => setPage(current => current + 1)}>Next →</button>
            </div>}
        </div>
    );
};

export default PostList;
