import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { queryClient, queryKeys } from "../api/queryClient";

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const SocketProvider = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    const socket = io(SOCKET_URL, {
      auth: { token: token || "" },
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      const currentToken = localStorage.getItem("accessToken");
      if (currentToken) {
        socket.emit("authenticate", currentToken);
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Global listener: Realtime new notification
    socket.on("notification:new", () => {
      queryClient.setQueryData(queryKeys.unreadCount(), (old = 0) => (typeof old === "number" ? old + 1 : 1));
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    });

    // A Super Admin changed this account's role: re-read /me so the UI matches the server
    socket.on("auth:role-changed", () => {
      refreshUser?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshUser]);

  // When auth user changes (login / logout), update socket auth and reconnect
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const token = localStorage.getItem("accessToken");
    socket.auth = { token: token || "" };

    if (token) {
      socket.emit("authenticate", token);
    } else {
      socket.disconnect().connect();
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context || { socket: null, isConnected: false };
};

export const usePostRoom = (postId) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !postId) return;
    socket.emit("join:post", postId);

    return () => {
      socket.emit("leave:post", postId);
    };
  }, [socket, postId]);
};

export const useUserRoom = (userId) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !userId) return;
    socket.emit("join:user", userId);

    return () => {
      socket.emit("leave:user", userId);
    };
  }, [socket, userId]);
};
