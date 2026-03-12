import { useState, useEffect, useCallback, useRef } from "react";
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

    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:error", onError);

    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:error", onError);
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

  return { messages, unreadCount, rateLimitError, panelOpen, openPanel, closePanel, sendMessage };
}
