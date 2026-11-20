import { useState } from "react";
import { Link, NavLink, matchPath, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Users,
  Compass,
  FileText,
  Bookmark,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiQuery } from "../api/api";
import { queryKeys } from "../api/queryClient";
import UserAvatar from "./UserAvatar";
import "./Sidebar.css";

/* ---------------------------------------------------------------
   Shared bits for the expandable panels
---------------------------------------------------------------- */
const PanelMessage = ({ children }) => <p className="sb-panel-message">{children}</p>;

const PanelSkeleton = () => (
  <div className="sb-skeleton-group" aria-hidden="true">
    <div className="sb-skeleton" />
    <div className="sb-skeleton short" />
    <div className="sb-skeleton" />
  </div>
);

const PanelError = ({ onRetry }) => (
  <PanelMessage>
    Couldn&apos;t load this.{" "}
    <button type="button" className="sb-retry" onClick={onRetry}>
      Retry
    </button>
  </PanelMessage>
);

const ViewAll = ({ to, children }) => (
  <Link to={to} className="sb-sublink sb-view-all">
    {children}
  </Link>
);

// A panel only mounts while its row is expanded, so these queries run on demand
// and re-fetch each time the row is opened.
const usePanelQuery = (queryKey, path, select) =>
  useQuery({
    queryKey,
    queryFn: () => apiQuery(path),
    select,
    refetchOnMount: "always",
    staleTime: 30 * 1000,
  });

const PersonLink = ({ person }) => (
  <Link to={`/profile/${person.username}`} className="sb-sublink sb-person" title={`@${person.username}`}>
    <UserAvatar user={person} size={22} />
    <span className="sb-sublink-text">{person.fullName || `@${person.username}`}</span>
  </Link>
);

const PostLink = ({ post }) => (
  <Link to={`/post/${post._id}`} className="sb-sublink" title={post.title}>
    <span className="sb-sublink-text">{post.title}</span>
    {post.status === "draft" && <span className="sb-badge">Draft</span>}
  </Link>
);

/* ---------------------------------------------------------------
   Panels
---------------------------------------------------------------- */
const SORT_LINKS = [
  { label: "Latest", sort: null },
  { label: "Most viewed", sort: "mostViewed" },
  { label: "Most liked", sort: "mostLiked" },
  { label: "Most commented", sort: "mostCommented" },
];

function ForYouPanel() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const currentSort = pathname === "/" ? searchParams.get("sort") : null;

  return (
    <ul className="sb-sublist">
      {SORT_LINKS.map(({ label, sort }) => {
        const active = pathname === "/" && (currentSort || null) === sort;
        return (
          <li key={label}>
            <Link
              to={sort ? `/?sort=${sort}` : "/"}
              className={`sb-sublink ${active ? "is-current" : ""}`}
              aria-current={active ? "true" : undefined}
            >
              <span className="sb-sublink-text">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FollowingPanel() {
  const { user } = useAuth();
  const meId = user?._id || user?.id;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.following(meId), "sidebar"],
    queryFn: () => apiQuery(`/users/${meId}/following?page=1&limit=8`),
    enabled: Boolean(meId),
    refetchOnMount: "always",
    staleTime: 30 * 1000,
  });

  if (!user) {
    return (
      <PanelMessage>
        <Link to="/login" className="sb-inline-link">
          Log in
        </Link>{" "}
        to see who you follow.
      </PanelMessage>
    );
  }
  if (isLoading) return <PanelSkeleton />;
  if (isError) return <PanelError onRetry={refetch} />;

  const people = data?.following || [];
  const total = data?.pagination?.total ?? people.length;

  if (people.length === 0) {
    return (
      <PanelMessage>
        You aren&apos;t following anyone yet.{" "}
        <Link to="/explore" className="sb-inline-link">
          Find people
        </Link>
      </PanelMessage>
    );
  }

  return (
    <ul className="sb-sublist">
      {people.map((person) => (
        <li key={person._id}>
          <PersonLink person={person} />
        </li>
      ))}
      {total > people.length && (
        <li>
          <ViewAll to={`/profile/${user.username || meId}/following`}>See all {total}</ViewAll>
        </li>
      )}
    </ul>
  );
}

function ExplorePanel() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = usePanelQuery(
    ["sidebar", "creators", user?._id || user?.id || "guest"],
    "/discover/authors",
    (authors) => (Array.isArray(authors) ? authors.filter((a) => !a.isSelf).slice(0, 5) : [])
  );

  if (isLoading) return <PanelSkeleton />;
  if (isError) return <PanelError onRetry={refetch} />;
  if (!data?.length) return <PanelMessage>No creators to show yet.</PanelMessage>;

  return (
    <>
      <p className="sb-sublist-caption">Top creators</p>
      <ul className="sb-sublist">
        {data.map((author) => (
          <li key={author._id}>
            <PersonLink person={author} />
          </li>
        ))}
      </ul>
    </>
  );
}

function MyPostsPanel() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = usePanelQuery(
    ["sidebar", "my-posts", user?._id || user?.id],
    "/posts/my?page=1&limit=5"
  );

  if (isLoading) return <PanelSkeleton />;
  if (isError) return <PanelError onRetry={refetch} />;

  const posts = data?.posts || [];
  if (posts.length === 0) {
    return (
      <PanelMessage>
        No posts yet.{" "}
        <Link to="/posts/create" className="sb-inline-link">
          Write a story
        </Link>
      </PanelMessage>
    );
  }

  const total = data?.pagination?.total ?? posts.length;
  return (
    <ul className="sb-sublist">
      {posts.map((post) => (
        <li key={post._id}>
          <PostLink post={post} />
        </li>
      ))}
      {total > posts.length && (
        <li>
          <ViewAll to="/my-posts">See all {total}</ViewAll>
        </li>
      )}
    </ul>
  );
}

function BookmarksPanel() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = usePanelQuery(
    ["sidebar", "bookmarks", user?._id || user?.id],
    "/bookmarks?page=1&limit=5"
  );

  if (isLoading) return <PanelSkeleton />;
  if (isError) return <PanelError onRetry={refetch} />;

  const posts = (data?.bookmarks || []).map((b) => b.post).filter(Boolean);
  if (posts.length === 0) return <PanelMessage>Nothing saved yet.</PanelMessage>;

  return (
    <ul className="sb-sublist">
      {posts.map((post) => (
        <li key={post._id}>
          <PostLink post={post} />
        </li>
      ))}
      <li>
        <ViewAll to="/bookmarks">See all bookmarks</ViewAll>
      </li>
    </ul>
  );
}

function DeletedPanel() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = usePanelQuery(
    ["sidebar", "deleted", user?._id || user?.id],
    "/posts/deleted?page=1&limit=5"
  );

  if (isLoading) return <PanelSkeleton />;
  if (isError) return <PanelError onRetry={refetch} />;

  const posts = data?.posts || [];
  if (posts.length === 0) return <PanelMessage>No deleted posts.</PanelMessage>;

  const total = data?.pagination?.total ?? posts.length;
  return (
    <ul className="sb-sublist">
      {posts.map((post) => (
        <li key={post._id}>
          <Link to="/deleted-posts" className="sb-sublink" title={post.title}>
            <span className="sb-sublink-text">{post.title}</span>
          </Link>
        </li>
      ))}
      {total > posts.length && (
        <li>
          <ViewAll to="/deleted-posts">See all {total}</ViewAll>
        </li>
      )}
    </ul>
  );
}

/* ---------------------------------------------------------------
   One expandable row. The label is a normal link; clicking it opens
   the row (and goes to the page). Clicking it again on its own page,
   or the chevron, collapses it.
---------------------------------------------------------------- */
function SidebarItem({ id, to, end = false, icon: Icon, label, open, onSetOpen, children }) {
  const { pathname } = useLocation();
  const active = Boolean(matchPath({ path: to, end }, pathname));
  const panelId = `sb-panel-${id}`;

  const handleLabelClick = () => {
    // Already on this page: behave like a plain toggle. Otherwise navigate and open.
    onSetOpen(id, active ? !open : true);
  };

  return (
    <li className={`sb-item ${open ? "is-open" : ""}`}>
      <div className={`sb-row ${active ? "active" : ""}`}>
        <NavLink to={to} end={end} className="sb-link" onClick={handleLabelClick}>
          <span className="sidebar-icon-tile">
            <Icon size={18} />
          </span>
          <span className="sidebar-label">{label}</span>
        </NavLink>
        <button
          type="button"
          className="sb-chevron"
          onClick={() => onSetOpen(id, !open)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open && (
        <div id={panelId} className="sb-panel">
          {children}
        </div>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------
   Collapsible group heading (Feeds / Your Space)
---------------------------------------------------------------- */
function SidebarGroup({ id, title, collapsed, onToggle, children }) {
  return (
    <section className="sb-group">
      <button
        type="button"
        className="sidebar-section-title sb-group-toggle"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
      >
        <span>{title}</span>
      </button>
      {!collapsed && <ul className="sidebar-list">{children}</ul>}
    </section>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Open the row for the page you are on when the sidebar first renders
  const [openItems, setOpenItems] = useState(() => {
    const initial = {};
    if (pathname === "/feed/following") initial.following = true;
    if (pathname === "/explore") initial.explore = true;
    if (pathname === "/my-posts") initial.myPosts = true;
    if (pathname === "/bookmarks") initial.bookmarks = true;
    if (pathname === "/deleted-posts") initial.deleted = true;
    return initial;
  });
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const setOpen = (id, value) => setOpenItems((prev) => ({ ...prev, [id]: value }));
  const toggleGroup = (id) => setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="desktop-sidebar">
      <nav className="desktop-sidebar-nav" aria-label="Sidebar">
        <SidebarGroup id="feeds" title="Feeds" collapsed={Boolean(collapsedGroups.feeds)} onToggle={toggleGroup}>
          <SidebarItem id="forYou" to="/" end icon={Sparkles} label="For You" open={Boolean(openItems.forYou)} onSetOpen={setOpen}>
            <ForYouPanel />
          </SidebarItem>
          <SidebarItem id="following" to="/feed/following" icon={Users} label="Following" open={Boolean(openItems.following)} onSetOpen={setOpen}>
            <FollowingPanel />
          </SidebarItem>
          <SidebarItem id="explore" to="/explore" icon={Compass} label="Explore" open={Boolean(openItems.explore)} onSetOpen={setOpen}>
            <ExplorePanel />
          </SidebarItem>
        </SidebarGroup>

        {user && (
          <SidebarGroup id="space" title="Your Space" collapsed={Boolean(collapsedGroups.space)} onToggle={toggleGroup}>
            <SidebarItem id="myPosts" to="/my-posts" icon={FileText} label="My Posts" open={Boolean(openItems.myPosts)} onSetOpen={setOpen}>
              <MyPostsPanel />
            </SidebarItem>
            <SidebarItem id="bookmarks" to="/bookmarks" icon={Bookmark} label="Bookmarks" open={Boolean(openItems.bookmarks)} onSetOpen={setOpen}>
              <BookmarksPanel />
            </SidebarItem>
            <SidebarItem id="deleted" to="/deleted-posts" icon={Trash2} label="Deleted Posts" open={Boolean(openItems.deleted)} onSetOpen={setOpen}>
              <DeletedPanel />
            </SidebarItem>
          </SidebarGroup>
        )}
      </nav>
    </aside>
  );
}
