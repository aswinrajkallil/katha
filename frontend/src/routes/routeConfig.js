import { matchPath } from "react-router-dom";

/**
 * Route metadata declarations.
 * isTopLevel: true for the 3 main feed pages (Home/For You, Following, Explore).
 * isTopLevel: false for secondary pages requiring a mobile back button.
 */
export const ROUTE_DEFS = [
  {
    path: "/",
    exact: true,
    isTopLevel: true,
    title: "For You",
    tabId: "home",
  },
  {
    path: "/feed/following",
    exact: true,
    isTopLevel: true,
    title: "Following",
    tabId: "following",
  },
  {
    path: "/explore",
    exact: true,
    isTopLevel: true,
    title: "Explore",
    tabId: "explore",
  },
  {
    path: "/posts/create",
    exact: true,
    isTopLevel: false,
    title: "Create post",
    tabId: null,
  },
  {
    path: "/posts/:id/edit",
    exact: true,
    isTopLevel: false,
    title: "Edit post",
    tabId: null,
  },
  {
    path: "/posts/:id",
    exact: true,
    isTopLevel: false,
    title: "Post",
    tabId: null,
  },
  {
    path: "/post/:id",
    exact: true,
    isTopLevel: false,
    title: "Post",
    tabId: null,
  },
  {
    path: "/profile/:id",
    exact: true,
    isTopLevel: false,
    title: (params) => {
      const id = params?.id || "";
      return id.startsWith("@") ? id : `@${id}`;
    },
    tabId: (params, user) => {
      const current = user?.username || user?._id;
      return params?.id && current && params.id === current ? "profile" : null;
    },
  },
  {
    path: "/profile/:id/:relation",
    exact: true,
    isTopLevel: false,
    title: (params) => {
      const rel = params?.relation || "connections";
      return rel.charAt(0).toUpperCase() + rel.slice(1);
    },
    tabId: null,
  },
  {
    path: "/profile/edit",
    exact: true,
    isTopLevel: false,
    title: "Edit profile",
    tabId: null,
  },
  {
    path: "/my-posts",
    exact: true,
    isTopLevel: false,
    title: "My Posts",
    tabId: "my-posts",
  },
  {
    path: "/bookmarks",
    exact: true,
    isTopLevel: false,
    title: "Bookmarks",
    tabId: "bookmarks",
  },
  {
    path: "/notifications",
    exact: true,
    isTopLevel: false,
    title: "Notifications",
    tabId: null,
  },
  {
    path: "/login",
    exact: true,
    isTopLevel: false,
    title: "Login",
    tabId: null,
  },
  {
    path: "/register",
    exact: true,
    isTopLevel: false,
    title: "Register",
    tabId: null,
  },
];

/**
 * Resolves current route information from pathname, searchParams, and user.
 */
export function getRouteInfo(pathname, searchParams, user) {
  const q = searchParams?.get?.("q") || "";

  // Check search results override first
  if (q && q.trim()) {
    return {
      isTopLevel: false,
      title: "Search results",
      tabId: pathname === "/" ? "home" : null,
      match: null,
    };
  }

  for (const def of ROUTE_DEFS) {
    const match = matchPath({ path: def.path, end: def.exact !== false }, pathname);
    if (match) {
      const isTopLevel = Boolean(def.isTopLevel);
      let title = "";
      if (typeof def.title === "function") {
        title = def.title(match.params, user);
      } else {
        title = def.title;
      }

      let tabId = null;
      if (typeof def.tabId === "function") {
        tabId = def.tabId(match.params, user);
      } else {
        tabId = def.tabId || null;
      }

      return {
        isTopLevel,
        title,
        tabId,
        match,
      };
    }
  }

  return {
    isTopLevel: false,
    title: "Kathā",
    tabId: null,
    match: null,
  };
}
