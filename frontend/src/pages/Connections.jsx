import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiQuery } from "../api/api";
import { queryKeys } from "../api/queryClient";
import BackButton from "../components/BackButton";

export default function Connections() {
    const { id, relation } = useParams();
    const type = relation === "following" ? "following" : "followers";
    const {
        data: people = [],
        isLoading: loading,
        error,
    } = useQuery({
        queryKey: type === "following" ? queryKeys.following(id) : queryKeys.followers(id),
        queryFn: async () => {
            const data = await apiQuery(`/users/${encodeURIComponent(id)}/${type}?page=1&limit=50`);
            return data[type] || [];
        },
    });
    const title = type === "following" ? "Following" : "Followers";
    return <main style={{ maxWidth: 680, margin: "32px auto", padding: 20 }}>
        <BackButton />
        <h1>{title}</h1>{loading && <p>Loading...</p>}{error && <p role="alert">{error.message}</p>}
        {!loading && !error && people.length === 0 && <p>No {title.toLowerCase()} yet.</p>}
        {people.map(person => <div key={person._id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
            <Link to={`/profile/${person.username}`}><strong>{person.fullName || person.username}</strong> @{person.username}</Link>
            {person.bio && <p>{person.bio}</p>}
        </div>)}
    </main>;
}
