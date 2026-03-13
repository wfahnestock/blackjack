import { Button } from "~/components/ui/Button";
import { MAX_PLAYERS } from "~/lib/constants";
import type { RoomListing } from "~/lib/types";

interface RoomCardProps {
  room: RoomListing;
  onJoin: (code: string) => void;
  joining: boolean;
}

function PhaseBadge({ phase }: { phase: RoomListing["phase"] }) {
  const isLobby = phase === "lobby";
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide
        ${isLobby
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
        }
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isLobby ? "bg-emerald-400" : "bg-amber-400"}`}
      />
      {isLobby ? "In Lobby" : "In Game"}
    </span>
  );
}

function PlayerAvatar({
  displayName,
  avatarColor,
}: {
  displayName: string;
  avatarColor: string;
}) {
  return (
    <div className="relative group/avatar">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-gray-900"
        style={{ backgroundColor: avatarColor }}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>
      {/* Tooltip */}
      <div
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2 py-1 bg-gray-800 border border-gray-700 rounded
          text-xs text-white whitespace-nowrap
          opacity-0 group-hover/avatar:opacity-100
          transition-opacity pointer-events-none z-20
        "
      >
        {displayName}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}

function EmptySeat() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-700 bg-gray-800/50" />
  );
}

export function RoomCard({ room, onJoin, joining }: RoomCardProps) {
  const { code, phase, settings, players, playerCount, maxPlayers } = room;
  const isFull = playerCount >= maxPlayers;

  const formatBet = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-base font-bold text-gray-200 tracking-widest">
          {code}
        </span>
        <PhaseBadge phase={phase} />
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div className="text-gray-500">Bet limits</div>
        <div className="text-gray-200 font-medium">
          {formatBet(settings.minBet)} – {formatBet(settings.maxBet)}
        </div>

        <div className="text-gray-500">Betting timer</div>
        <div className="text-gray-200 font-medium">{settings.bettingTimerSeconds}s</div>

        <div className="text-gray-500">Turn timer</div>
        <div className="text-gray-200 font-medium">{settings.turnTimerSeconds}s</div>
      </div>

      {/* Feature pills */}
      {(settings.allowCountingHint || settings.bankruptcyProtection) && (
        <div className="flex flex-wrap gap-1.5">
          {settings.allowCountingHint && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium">
              🃏 Count hint
            </span>
          )}
          {settings.bankruptcyProtection && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium">
              🛡 Bankruptcy protection
            </span>
          )}
        </div>
      )}

      {/* Players */}
      <div className="flex items-center gap-3">
        {/* Avatar stack */}
        <div className="flex -space-x-2">
          {/* Filled seats */}
          {players.map((p, i) => (
            <PlayerAvatar key={i} displayName={p.displayName} avatarColor={p.avatarColor} />
          ))}
          {/* Empty seats */}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
            <EmptySeat key={`empty-${i}`} />
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-1">
          {playerCount}/{maxPlayers}
          {isFull && <span className="ml-1 text-red-400">· Full</span>}
        </span>
      </div>

      {/* Join button */}
      <Button
        variant="primary"
        size="md"
        className="w-full mt-auto"
        onClick={() => onJoin(code)}
        disabled={joining}
      >
        {joining ? "Joining…" : "Join Table"}
      </Button>
    </div>
  );
}
