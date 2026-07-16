import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents, GameState, ChatMessage } from "./types.js";
import { NGROK_HEADER, NGROK_HEADER_VALUE } from "./ngrok.js";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// Module-level game state cache — populated as soon as the socket module
// is first imported (which happens on the home page, before any navigation).
// This ensures state:sync events fired right after room:create/join are never
// lost even if the lobby route hasn't mounted yet.
export let cachedGameState: GameState | null = null;

// Module-level chat history cache — same reasoning as cachedGameState.
// The server sends chat:history immediately after room:join/create, before
// the lobby route (and useChat) has had a chance to mount and register a listener.
// useChat drains this cache on mount, then takes over with its own listener.
export let cachedChatHistory: ChatMessage[] | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      withCredentials: true,
      // The Socket.io handshake starts as an XHR poll, which ngrok would answer
      // with its HTML warning page and break the connection. Browsers can't set
      // headers on the WebSocket upgrade itself, but the polling handshake that
      // precedes it is what needs this.
      extraHeaders: { [NGROK_HEADER]: NGROK_HEADER_VALUE },
      transportOptions: {
        polling: {
          extraHeaders: { [NGROK_HEADER]: NGROK_HEADER_VALUE },
        },
      },
    });
    socket.on("state:sync", (s) => { cachedGameState = s; });
    socket.on("chat:history", (h) => { cachedChatHistory = h; });
  }
  return socket;
}

export function clearGameState(): void {
  cachedGameState = null;
}

export function clearChatHistory(): void {
  cachedChatHistory = null;
}
