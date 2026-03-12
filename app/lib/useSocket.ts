import { useEffect } from "react";
import { getSocket } from "./socket.js";

export function useSocket() {
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) {
      // Attach the latest JWT so the server can authenticate this connection
      socket.auth = { token: localStorage.getItem("bj_auth_token") ?? "" };
      socket.connect();
    }
    return () => {
      // Don't disconnect on unmount — keep persistent connection
    };
  }, [socket]);

  return socket;
}
