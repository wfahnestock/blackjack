import { useState, useEffect, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import type { ChatMessage } from "~/lib/types";
import type { getSocket } from "~/lib/socket";

type AppSocket = ReturnType<typeof getSocket>;

export interface UseChatReturn {
  messages: ChatMessage[];
  unreadCount: number;
  rateLimitError: string;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  sendMessage: (text: string) => void;
  removeMessage: (messageId: string) => void;
  clearChat: () => void;
}

export function useChat(socket: AppSocket): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [rateLimitError, setRateLimitError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so the socket handlers can read the current value without
  // being recreated on every render.
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  useEffect(() => {
    function onHistory(history: ChatMessage[]) {
      setMessages(history);
    }

    function onMessage(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
      if (!panelOpenRef.current) {
        setUnreadCount((n) => n + 1);
      }
    }

    function onError(payload: { message: string }) {
      setRateLimitError(payload.message);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setRateLimitError(""), 3000);
    }

    function onMessageRemoved(payload: { messageId: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === payload.messageId ? { ...m, censored: true } : m
        )
      );
    }

    function onCleared(payload: { clearedBy: string }) {
      const notice: ChatMessage = {
        messageId: nanoid(),
        playerId: "system",
        displayName: "System",
        avatarColor: "#6B7280",
        message: `${payload.clearedBy} has cleared the chat!`,
        censored: false,
        timestamp: Date.now(),
        roles: [],
        isSystem: true,
      };
      setMessages([notice]);
    }

    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:error", onError);
    socket.on("chat:message_removed", onMessageRemoved);
    socket.on("chat:cleared", onCleared);

    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:error", onError);
      socket.off("chat:message_removed", onMessageRemoved);
      socket.off("chat:cleared", onCleared);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [socket]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    setUnreadCount(0);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      socket.emit("chat:send", { message: trimmed });
    },
    [socket]
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      socket.emit("chat:remove_message", { messageId });
    },
    [socket]
  );

  const clearChat = useCallback(() => {
    socket.emit("chat:clear");
  }, [socket]);

  return { messages, unreadCount, rateLimitError, panelOpen, openPanel, closePanel, sendMessage, removeMessage, clearChat };
}
