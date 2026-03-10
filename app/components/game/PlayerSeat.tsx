import type { Player } from "~/lib/types";
import { PlayerHand } from "./PlayerHand";
import { StatusBadge } from "~/components/ui/Badge";
import { formatChips } from "~/lib/handUtils";

interface PlayerSeatProps {
  player: Player;
  activeHandId: string | null;
  isCurrentPlayer: boolean;
  isSelf: boolean;
}

export function PlayerSeat({ player, activeHandId, isCurrentPlayer, isSelf }: PlayerSeatProps) {
  const isDisconnected = player.status === "disconnected";

  return (
    <div
      className={`
        flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300
        ${isCurrentPlayer ? "bg-gray-900 ring-2 ring-emerald-500" : "bg-gray-900/50"}
        ${isDisconnected ? "opacity-50" : ""}
        min-w-[120px]
      `}
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-gray-700"
          style={{ backgroundColor: player.avatarColor }}
        />
        <div className="flex flex-col min-w-0">
          <span className={`text-sm font-semibold truncate max-w-[80px] ${isSelf ? "text-emerald-400" : "text-gray-200"}`}>
            {player.displayName}
            {isSelf && " (you)"}
          </span>
          <span className="text-xs text-yellow-500 font-medium">
            {formatChips(player.chips)} chips
          </span>
        </div>
      </div>

      {/* Status */}
      <StatusBadge status={player.status} />

      {/* Hands */}
      {player.hands.length > 0 && (
        <div className="flex gap-3 flex-wrap justify-center">
          {player.hands.map((hand) => (
            <PlayerHand
              key={hand.handId}
              hand={hand}
              isActive={isCurrentPlayer && hand.handId === activeHandId}
              small
            />
          ))}
        </div>
      )}
    </div>
  );
}
