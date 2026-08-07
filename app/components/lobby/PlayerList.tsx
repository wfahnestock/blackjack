import type { Player } from "~/lib/types";
import { formatChips } from "~/lib/handUtils";
import { DisplayName } from "~/components/ui/DisplayName";

interface PlayerListProps {
  players: Player[];
  selfPlayerId: string;
  onPlayerClick?: (playerId: string) => void;
}

export function PlayerList({ players, selfPlayerId, onPlayerClick }: PlayerListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="casino-eyebrow">Players ({players.length})</span>
        {onPlayerClick && (
          <span className="text-[10.5px] text-[#6b6144]">· select to view profile</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {players.map((player) => (
          <div
            key={player.playerId}
            className={`flex items-center gap-3 rounded-md border px-2.5 py-2 transition-colors ${
              player.playerId === selfPlayerId
                ? "border-[var(--brass)]/28 bg-[var(--brass)]/[0.08]"
                : "border-[var(--brass)]/12 bg-black/25"
            } ${onPlayerClick ? "cursor-pointer hover:bg-white/[0.05]" : ""}`}
            onClick={() => onPlayerClick?.(player.playerId)}
          >
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--brass)]/35 text-sm font-bold text-white"
              style={{ backgroundColor: player.avatarColor }}
            >
              {player.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DisplayName
                  displayName={player.displayName}
                  nameEffect={player.nameEffect}
                  className="truncate text-[13px] font-semibold text-[#e6d9b6]"
                />
                {player.playerId === selfPlayerId && (
                  <span className="shrink-0 rounded border border-[var(--brass)]/30 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-[var(--parchment-dim)]">
                    You
                  </span>
                )}
                {player.isHost && (
                  <span className="shrink-0 rounded border border-[var(--brass)]/40 bg-[var(--brass)]/15 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-[#e8cd7a]">
                    Host
                  </span>
                )}
              </div>
              <span className="text-[11px] tabular-nums text-[#a8996d]">
                {formatChips(player.chips)} chips
              </span>
            </div>
            <div
              title={player.status === "connected" ? "Connected" : "Disconnected"}
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                player.status === "connected" ? "bg-emerald-400" : "bg-[#5d5540]"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
