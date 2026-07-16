import { useState, useEffect } from "react";
import type { GameState, Player, Hand, ShoeState } from "./types.js";
import { getSocket, cachedGameState } from "./socket.js";
import { useSocket } from "./useSocket.js";

export function useGameState() {
  useSocket(); // ensure socket is connected
  const socket = getSocket();

  // Initialise from cache so state:sync events that arrived before this
  // component mounted (e.g. immediately after room:create) are not lost.
  const [state, setState] = useState<GameState | null>(() => cachedGameState);

  useEffect(() => {
    // Catch any update that arrived between the useState() init and useEffect registration
    if (cachedGameState !== state) {
      setState(cachedGameState);
    }

    // Pending staggered deal-animation timers (from game:card-dealt). Each one
    // blindly appends a card, so a timer that fires *after* an authoritative
    // state update would append a card the update already included, producing a
    // phantom extra card (e.g. 3 cards after the opening deal). This happens when
    // the timers are delayed past the sync — most commonly background-tab timer
    // throttling, also network jitter or a slow frame. Cards can't be deduped by
    // value (a 6-deck shoe has identical rank+suit cards), so instead we cancel
    // any outstanding deal timers whenever an authoritative update lands.
    const pendingDeals = new Set<ReturnType<typeof setTimeout>>();
    const cancelPendingDeals = () => {
      pendingDeals.forEach(clearTimeout);
      pendingDeals.clear();
    };

    const onSync = (newState: GameState) => {
      cancelPendingDeals();
      setState(newState);
    };

    const onPhaseChanged = ({ phase, phaseEndsAt, activePlayerId, activeHandId }: Pick<GameState, "phase" | "phaseEndsAt" | "activePlayerId" | "activeHandId">) => {
      setState((prev) => prev ? { ...prev, phase, phaseEndsAt, activePlayerId, activeHandId } : prev);
    };

    const onPlayerUpdated = (player: Player) => {
      cancelPendingDeals();
      setState((prev) => prev
        ? { ...prev, players: prev.players.map((p) => p.playerId === player.playerId ? player : p) }
        : prev);
    };

    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      cancelPendingDeals();
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => p.playerId !== playerId ? p : {
            ...p,
            hands: p.hands.map((h) => h.handId === hand.handId ? hand : h),
          }),
        };
      });
    };

    const onDealerUpdated = (dealerHand: Hand) => {
      cancelPendingDeals();
      setState((prev) => prev ? { ...prev, dealerHand } : prev);
    };

    const onShoeUpdated = (shoe: ShoeState) => {
      setState((prev) => prev ? { ...prev, shoe } : prev);
    };

    const onCardDealt = ({ target, playerId, handId, card, delay }: {
      target: "dealer" | "player"; playerId?: string; handId?: string; card: any; delay: number;
    }) => {
      const timer = setTimeout(() => {
        pendingDeals.delete(timer);
        setState((prev) => {
          if (!prev) return prev;
          const shoeNext = { ...prev.shoe, cardsRemaining: prev.shoe.cardsRemaining - 1, penetration: 1 - (prev.shoe.cardsRemaining - 1) / prev.shoe.totalCards };
          if (target === "dealer") {
            return { ...prev, dealerHand: { ...prev.dealerHand, cards: [...prev.dealerHand.cards, card] }, shoe: shoeNext };
          }
          return {
            ...prev,
            players: prev.players.map((p) => p.playerId !== playerId ? p : {
              ...p,
              hands: p.hands.map((h) => h.handId !== handId ? h : { ...h, cards: [...h.cards, card] }),
            }),
            shoe: shoeNext,
          };
        });
      }, delay);
      pendingDeals.add(timer);
    };

    const onShuffle = () => {
      setState((prev) => prev
        ? { ...prev, shoe: { ...prev.shoe, cardsRemaining: 312, penetration: 0, shufflePending: false }, hiLoCount: 0 }
        : prev);
    };

    socket.on("state:sync", onSync);
    socket.on("state:phase-changed", onPhaseChanged as any);
    socket.on("state:player-updated", onPlayerUpdated);
    socket.on("state:hand-updated", onHandUpdated);
    socket.on("state:dealer-updated", onDealerUpdated);
    socket.on("state:shoe-updated", onShoeUpdated);
    socket.on("game:card-dealt", onCardDealt as any);
    socket.on("game:shuffle", onShuffle);

    return () => {
      socket.off("state:sync", onSync);
      socket.off("state:phase-changed", onPhaseChanged as any);
      socket.off("state:player-updated", onPlayerUpdated);
      socket.off("state:hand-updated", onHandUpdated);
      socket.off("state:dealer-updated", onDealerUpdated);
      socket.off("state:shoe-updated", onShoeUpdated);
      socket.off("game:card-dealt", onCardDealt as any);
      socket.off("game:shuffle", onShuffle);
      cancelPendingDeals();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
