import { useEffect, useState } from "react";
import { useSocket } from "~/lib/useSocket";
import type { RoomListing } from "~/lib/types";
import { MAX_PLAYERS } from "~/lib/constants";
import { formatChips } from "~/lib/handUtils";

interface RoomBrowserProps {
  /** Called when the player clicks a room row. */
  onJoin: (code: string) => void;
  /** The code currently being joined (to show loading state on the right row). */
  joiningCode: string | null;
}

/** Human label for the phase shown on a room row. */
function phaseLabel(phase: RoomListing["phase"]): string {
  return phase === "lobby" ? "In lobby" : "In play";
}

export function RoomBrowser({ onJoin, joiningCode }: RoomBrowserProps) {
  const socket = useSocket();
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    socket.emit("rooms:subscribe", (initial: RoomListing[]) => {
      setRooms(initial);
      setLoaded(true);
    });

    const onUpdated = (updated: RoomListing[]) => setRooms(updated);
    socket.on("rooms:updated", onUpdated);

    return () => {
      socket.off("rooms:updated", onUpdated);
    };
  }, [socket]);

  return (
    <div>
      <p className="casino-eyebrow mb-2.5">
        Open Tables{loaded && rooms.length > 0 ? ` · ${rooms.length}` : ""}
      </p>

      {!loaded ? (
        <p className="py-5 text-[11px] text-[#6b6144]">Looking for tables…</p>
      ) : rooms.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-2xl mb-2 select-none text-[var(--brass)]/25">♠</div>
          <p className="text-[12px] text-[#8d7c58]">No tables open right now.</p>
          <p className="text-[11px] text-[#6b6144] mt-1">Create one to get things started.</p>
        </div>
      ) : (
        <div>
          {rooms.map((room, i) => {
            const joining = joiningCode === room.code;
            const full = room.playerCount >= room.maxPlayers;
            return (
              <button
                key={room.code}
                onClick={() => !full && onJoin(room.code)}
                disabled={full || !!joiningCode}
                className={`w-full flex items-center gap-3 py-2.5 text-left transition-colors group ${
                  i === rooms.length - 1 ? "" : "border-b border-white/[0.06]"
                } ${full ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.03]"}`}
              >
                {/* Felt swatch — a miniature of the table you'd be sitting at. */}
                <span
                  className="w-[34px] h-[24px] rounded-[3px] flex-none border border-black/45"
                  style={{
                    background: "radial-gradient(ellipse at 50% 32%, #2f9160, #0f3a24)",
                    boxShadow: "inset 0 0 5px rgba(0,0,0,0.4)",
                  }}
                />

                <span className="min-w-0">
                  <span className="block font-mono text-[13px] tracking-[0.05em] text-[#f0e4c6]">
                    {room.code}
                  </span>
                  <span className="block text-[10px] text-[#7d6f4d]">
                    {formatChips(room.settings.minBet)} – {formatChips(room.settings.maxBet)}
                  </span>
                </span>

                <span className="ml-auto text-right">
                  {/* One dot per seat, filled for occupied. */}
                  <span className="flex gap-[3px] justify-end">
                    {Array.from({ length: room.maxPlayers || MAX_PLAYERS }).map((_, s) => (
                      <span
                        key={s}
                        className={`w-[7px] h-[7px] rounded-full ${
                          s < room.playerCount ? "bg-[var(--brass)]" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.1em] text-[#7d6f4d] mt-1">
                    {joining ? "Joining…" : full ? "Full" : phaseLabel(room.phase)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
