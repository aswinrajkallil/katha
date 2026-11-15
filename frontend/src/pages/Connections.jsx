import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiFetch from "../api/api";
import BackButton from "../components/BackButton";

export default function Connections() {
    const { id, relation } = useParams();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        const type = relation === "following" ? "following" : "followers";
        apiFetch(`/users/${encodeURIComponent(id)}/${type}?page=1&limit=50`)
            .then(async res => {
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Unable to load users");
                if (active) setPeople(data.data[type] || []);
            }).catch(err => { if (active) setError(err.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id, relation]);
    const title = relation === "following" ? "Following" : "Followers";
    return <main style={{ maxWidth: 680, margin: "32px auto", padding: 20 }}>
        <BackButton />
        <h1>{title}</h1>{loading && <p>Loading...</p>}{error && <p role="alert">{error}</p>}
        {!loading && !error && people.length === 0 && <p>No {title.toLowerCase()} yet.</p>}
        {people.map(person => <div key={person._id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
            <Link to={`/profile/${person.username}`}><strong>{person.fullName || person.username}</strong> @{person.username}</Link>
            {person.bio && <p>{person.bio}</p>}
        </div>)}
    </main>;
}
