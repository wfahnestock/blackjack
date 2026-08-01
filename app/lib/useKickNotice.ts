import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getSocket } from "./socket.js";
import { clearGameState, clearChatHistory } from "./socket.js";

const KICK_KEY = "bj_kick_notice";

export interface KickNotice {
  reason: string | null;
  at: number;
}

/**
 * Listens for a staff kick and sends the player back to the main menu.
 *
 * The reason is handed over through sessionStorage rather than router state so
 * it survives the navigation regardless of where the player was (table or
 * lobby), and so a full reload can't leave them staring at a table they're no
 * longer in. Home picks it up and shows the dialog.
 */
export function useKickNotice(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();

    const onKicked = ({ reason }: { reason: string | null }) => {
      try {
        const notice: KickNotice = { reason: reason ?? null, at: Date.now() };
        window.sessionStorage.setItem(KICK_KEY, JSON.stringify(notice));
      } catch {
        /* sessionStorage unavailable — we still navigate, just without the reason */
      }
      // Drop any cached table state so the room can't briefly re-render.
      clearGameState();
      clearChatHistory();
      navigate("/", { replace: true });
    };

    socket.on("game:kicked", onKicked as any);
    return () => {
      socket.off("game:kicked", onKicked as any);
    };
  }, [navigate]);
}

/** Reads and clears a pending kick notice. Returns null when there isn't one. */
export function consumeKickNotice(): KickNotice | null {
  try {
    const raw = window.sessionStorage.getItem(KICK_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KICK_KEY);
    return JSON.parse(raw) as KickNotice;
  } catch {
    return null;
  }
}
