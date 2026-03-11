import { useEffect, useRef, useState } from "react";
import type { Hand, Player, RoundResult } from "~/lib/types";
import { getSocket } from "~/lib/socket";
import { getBestValue, formatChips } from "~/lib/handUtils";
import { PlayerHand } from "./PlayerHand";
import { StatusBadge } from "~/components/ui/Badge";

// ─── Payout floater ──────────────────────────────────────────────────────────

interface PayoutFloater {
  id:     string;
  net:    number;
  result: NonNullable<RoundResult["result"]>;
}

const PAYOUT_COLORS: Record<NonNullable<RoundResult["result"]>, string> = {
  win:       "text-emerald-400",
  blackjack: "text-yellow-400",
  push:      "text-gray-400",
  lose:      "text-red-400",
  bust:      "text-red-500",
};

function formatNet(net: number, result: PayoutFloater["result"]): string {
  if (result === "push") return "Push";
  return net >= 0 ? `+${net}` : `${net}`;
}

function usePayoutFloaters(player: Player) {
  const [floaters, setFloaters] = useState<PayoutFloater[]>([]);

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

      const next: PayoutFloater[] = mine.map((r) => {
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

// ─── Action floater ───────────────────────────────────────────────────────────

type ActionType = "hit" | "stand" | "double_down" | "split";

interface ActionFloater {
  id:     string;
  action: ActionType;
}

const ACTION_LABELS: Record<ActionType, string> = {
  hit:         "Hit",
  stand:       "Stand",
  double_down: "Double Down",
  split:       "Split",
};

const ACTION_COLORS: Record<ActionType, string> = {
  hit:         "text-sky-400",
  stand:       "text-gray-300",
  double_down: "text-amber-400",
  split:       "text-violet-400",
};

const ACTION_FLOATER_MS = 1100;

// Tracks what each hand looked like on the previous update so we can infer
// what action just happened (card added → hit/double; stood changed → stand).
interface HandTrack {
  cardCount: number;
  stood:     boolean;
}

function useActionFloaters(player: Player) {
  const [floaters, setFloaters] = useState<ActionFloater[]>([]);
  const handPrev = useRef<Map<string, HandTrack>>(new Map());

  useEffect(() => {
    const socket = getSocket();

    // Seed from hands currently in state so the first update has a baseline.
    for (const hand of player.hands) {
      if (!handPrev.current.has(hand.handId)) {
        handPrev.current.set(hand.handId, { cardCount: hand.cards.length, stood: hand.stood });
      }
    }

    const spawn = (action: ActionType) => {
      const id = `${action}-${Date.now()}-${Math.random()}`;
      setFloaters((prev) => [...prev, { id, action }]);
      setTimeout(() => {
        setFloaters((prev) => prev.filter((f) => f.id !== id));
      }, ACTION_FLOATER_MS + 100);
    };

    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      if (playerId !== player.playerId) return;

      const prev         = handPrev.current.get(hand.handId);
      const cardAdded    = prev !== undefined && hand.cards.length > prev.cardCount;
      const stoodChanged = prev !== undefined && hand.stood && !prev.stood;

      if (cardAdded && hand.cards.length > 2) {
        // Only spawn for cards beyond the initial 2-card deal (avoids false
        // "Hit" labels during the opening deal when 0→1→2 cards arrive).
        spawn(hand.doubled ? "double_down" : "hit");
      } else if (stoodChanged && !hand.doubled) {
        // Skip auto-stand after a double-down (not a player-chosen action).
        // Also skip for natural blackjacks — payout floater covers that.
        const isBJ =
          hand.cards.length === 2 &&
          hand.splitFromHandId === null &&
          getBestValue(hand.cards) === 21;
        if (!isBJ) spawn("stand");
      }

      handPrev.current.set(hand.handId, { cardCount: hand.cards.length, stood: hand.stood });
    };

    const onPlayerUpdated = (updated: Player) => {
      if (updated.playerId !== player.playerId) return;

      let hadSplit = false;
      for (const hand of updated.hands) {
        // A hand we've never tracked with a non-null splitFromHandId is new from a split.
        if (!handPrev.current.has(hand.handId) && hand.splitFromHandId !== null) {
          hadSplit = true;
        }
        if (!handPrev.current.has(hand.handId)) {
          handPrev.current.set(hand.handId, { cardCount: hand.cards.length, stood: hand.stood });
        }
      }
      if (hadSplit) spawn("split");
    };

    socket.on("state:hand-updated",   onHandUpdated as any);
    socket.on("state:player-updated", onPlayerUpdated as any);

    return () => {
      socket.off("state:hand-updated",   onHandUpdated as any);
      socket.off("state:player-updated", onPlayerUpdated as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.playerId]);

  return floaters;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlayerSeatProps {
  player:          Player;
  activeHandId:    string | null;
  isCurrentPlayer: boolean;
  isSelf:          boolean;
}

export function PlayerSeat({ player, activeHandId, isCurrentPlayer, isSelf }: PlayerSeatProps) {
  const isDisconnected = player.status === "disconnected";
  const payoutFloaters = usePayoutFloaters(player);
  const actionFloaters = useActionFloaters(player);

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

      {/* Action floaters — rise from the centre of the seat */}
      {actionFloaters.map((f) => (
        <span
          key={f.id}
          className={`action-floater z-10000 absolute top-1/2 left-1/2 text-base font-bold tracking-wide uppercase whitespace-nowrap drop-shadow-md ${ACTION_COLORS[f.action]}`}
        >
          {ACTION_LABELS[f.action]}
        </span>
      ))}

      {/* Payout floaters — rise from the bottom of the seat */}
      {payoutFloaters.map((f) => (
        <span
          key={f.id}
          className={`payout-floater absolute bottom-0 left-1/2 -translate-x-1/2 text-base font-black drop-shadow-lg whitespace-nowrap ${PAYOUT_COLORS[f.result]}`}
        >
          {formatNet(f.net, f.result)}
        </span>
      ))}
    </div>
  );
}
