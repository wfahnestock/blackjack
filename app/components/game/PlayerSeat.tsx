import { useEffect, useRef, useState } from "react";
import type { Hand, Player, RoundResult } from "~/lib/types";
import { getSocket } from "~/lib/socket";
import { PlayerHand } from "./PlayerHand";
import { StatusBadge } from "~/components/ui/Badge";
import { formatChips } from "~/lib/handUtils";

// ─── Payout floater ──────────────────────────────────────────────────────────

interface Floater {
  id: string;
  net: number;
  result: NonNullable<RoundResult["result"]>;
}

const FLOATER_COLORS: Record<NonNullable<RoundResult["result"]>, string> = {
  win:       "text-emerald-400",
  blackjack: "text-yellow-400",
  push:      "text-gray-400",
  lose:      "text-red-400",
  bust:      "text-red-500",
};

function formatNet(net: number, result: Floater["result"]): string {
  if (result === "push") return "Push";
  return net >= 0 ? `+${net}` : `${net}`;
}

function usePayoutFloaters(player: Player) {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  // Tracks each hand's bet by handId so we can compute net profit/loss.
  // Updated synchronously via socket events (state:player-updated always
  // precedes game:round-result in the event stream).
  const betMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const socket = getSocket();

    // Seed from hands already in state when the listener registers
    for (const hand of player.hands) {
      if (hand.bet > 0) betMap.current.set(hand.handId, hand.bet);
    }

    const onPlayerUpdated = (updated: Player) => {
      if (updated.playerId !== player.playerId) return;
      for (const hand of updated.hands) {
        if (hand.bet > 0) betMap.current.set(hand.handId, hand.bet);
      }
    };

    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      if (playerId !== player.playerId) return;
      if (hand.bet > 0) betMap.current.set(hand.handId, hand.bet);
    };

    const onRoundResult = (results: RoundResult[]) => {
      const mine = results.filter((r) => r.playerId === player.playerId);
      if (mine.length === 0) return;

      const next: Floater[] = mine.map((r) => {
        const bet = betMap.current.get(r.handId) ?? 0;
        return {
          id:     `${r.handId}-${Date.now()}`,
          net:    r.payout - bet,
          result: r.result!,
        };
      });

      setFloaters((prev) => [...prev, ...next]);

      // Remove after animation finishes (1.8 s)
      setTimeout(() => {
        const ids = new Set(next.map((f) => f.id));
        setFloaters((prev) => prev.filter((f) => !ids.has(f.id)));
      }, 1900);
    };

    socket.on("state:player-updated", onPlayerUpdated as any);
    socket.on("state:hand-updated",   onHandUpdated as any);
    socket.on("game:round-result",    onRoundResult as any);

    return () => {
      socket.off("state:player-updated", onPlayerUpdated as any);
      socket.off("state:hand-updated",   onHandUpdated as any);
      socket.off("game:round-result",    onRoundResult as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.playerId]);

  return floaters;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlayerSeatProps {
  player: Player;
  activeHandId: string | null;
  isCurrentPlayer: boolean;
  isSelf: boolean;
}

export function PlayerSeat({ player, activeHandId, isCurrentPlayer, isSelf }: PlayerSeatProps) {
  const isDisconnected = player.status === "disconnected";
  const floaters = usePayoutFloaters(player);

  return (
    <div
      className={`
        relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300
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

      {/* Payout floaters */}
      {floaters.map((f) => (
        <span
          key={f.id}
          className={`payout-floater absolute bottom-0 left-1/2 -translate-x-1/2 text-base font-black drop-shadow-lg whitespace-nowrap ${FLOATER_COLORS[f.result]}`}
        >
          {formatNet(f.net, f.result)}
        </span>
      ))}
    </div>
  );
}
