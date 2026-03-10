import { useEffect } from "react";
import { getSocket } from "./socket.js";

export function useSocket() {
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      // Don't disconnect on unmount — keep persistent connection
    };
  }, [socket]);

  return socket;
}
