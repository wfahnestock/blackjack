import type { Player } from "~/lib/types";
import { formatChips } from "~/lib/handUtils";

interface PlayerListProps {
  players: Player[];
  selfPlayerId: string;
  onPlayerClick?: (playerId: string) => void;
}

export function PlayerList({ players, selfPlayerId, onPlayerClick }: PlayerListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Players ({players.length})
        </span>
        {onPlayerClick && (
          <span className="text-xs text-gray-700">· click to view profile</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {players.map((player) => (
          <div
            key={player.playerId}
            className={`flex items-center gap-3 p-2.5 rounded-xl bg-gray-800/60 border border-gray-800 ${onPlayerClick ? "cursor-pointer hover:bg-gray-700/60 transition-colors" : ""}`}
            onClick={() => onPlayerClick?.(player.playerId)}
          >
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.avatarColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold truncate ${
                    player.playerId === selfPlayerId ? "text-emerald-400" : "text-gray-200"
                  }`}
                >
                  {player.displayName}
                  {player.playerId === selfPlayerId && " (you)"}
                </span>
                {player.isHost && (
                  <span className="text-xs bg-amber-900/50 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded-full">
                    Host
                  </span>
                )}
              </div>
              <span className="text-xs text-yellow-600">
                {formatChips(player.chips)} chips
              </span>
            </div>
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                player.status === "connected" ? "bg-emerald-500" : "bg-gray-600"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
