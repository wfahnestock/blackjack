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

    const onSync = (newState: GameState) => setState(newState);

    const onPhaseChanged = ({ phase, phaseEndsAt, activePlayerId, activeHandId }: Pick<GameState, "phase" | "phaseEndsAt" | "activePlayerId" | "activeHandId">) => {
      setState((prev) => prev ? { ...prev, phase, phaseEndsAt, activePlayerId, activeHandId } : prev);
    };

    const onPlayerUpdated = (player: Player) => {
      setState((prev) => prev
        ? { ...prev, players: prev.players.map((p) => p.playerId === player.playerId ? player : p) }
        : prev);
    };

    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
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
      setState((prev) => prev ? { ...prev, dealerHand } : prev);
    };

    const onShoeUpdated = (shoe: ShoeState) => {
      setState((prev) => prev ? { ...prev, shoe } : prev);
    };

    const onCardDealt = ({ target, playerId, handId, card, delay }: {
      target: "dealer" | "player"; playerId?: string; handId?: string; card: any; delay: number;
    }) => {
      setTimeout(() => {
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
