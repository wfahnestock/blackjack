import { useState, useEffect } from "react";
import type { GameState, Player, Hand, ShoeState } from "./types.js";
import { useSocket } from "./useSocket.js";

export function useGameState() {
  const socket = useSocket();
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    socket.on("state:sync", (newState) => {
      setState(newState);
    });

    socket.on("state:phase-changed", ({ phase, phaseEndsAt, activePlayerId, activeHandId }) => {
      setState((prev) =>
        prev ? { ...prev, phase, phaseEndsAt, activePlayerId, activeHandId } : prev
      );
    });

    socket.on("state:player-updated", (player: Player) => {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.playerId === player.playerId ? player : p
          ),
        };
      });
    });

    socket.on("state:hand-updated", ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            if (p.playerId !== playerId) return p;
            return {
              ...p,
              hands: p.hands.map((h) => (h.handId === hand.handId ? hand : h)),
            };
          }),
        };
      });
    });

    socket.on("state:dealer-updated", (dealerHand) => {
      setState((prev) => (prev ? { ...prev, dealerHand } : prev));
    });

    socket.on("state:shoe-updated", (shoe: ShoeState) => {
      setState((prev) => (prev ? { ...prev, shoe } : prev));
    });

    socket.on("game:card-dealt", ({ target, playerId, handId, card, delay }) => {
      setTimeout(() => {
        setState((prev) => {
          if (!prev) return prev;

          if (target === "dealer") {
            return {
              ...prev,
              dealerHand: {
                ...prev.dealerHand,
                cards: [...prev.dealerHand.cards, card],
              },
              shoe: {
                ...prev.shoe,
                cardsRemaining: prev.shoe.cardsRemaining - 1,
                penetration: 1 - (prev.shoe.cardsRemaining - 1) / prev.shoe.totalCards,
              },
            };
          }

          return {
            ...prev,
            players: prev.players.map((p) => {
              if (p.playerId !== playerId) return p;
              return {
                ...p,
                hands: p.hands.map((h) => {
                  if (h.handId !== handId) return h;
                  return { ...h, cards: [...h.cards, card] };
                }),
              };
            }),
            shoe: {
              ...prev.shoe,
              cardsRemaining: prev.shoe.cardsRemaining - 1,
              penetration: 1 - (prev.shoe.cardsRemaining - 1) / prev.shoe.totalCards,
            },
          };
        });
      }, delay);
    });

    socket.on("game:shuffle", () => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              shoe: { ...prev.shoe, cardsRemaining: 312, penetration: 0, shufflePending: false },
              hiLoCount: 0,
            }
          : prev
      );
    });

    return () => {
      socket.off("state:sync");
      socket.off("state:phase-changed");
      socket.off("state:player-updated");
      socket.off("state:hand-updated");
      socket.off("state:dealer-updated");
      socket.off("state:shoe-updated");
      socket.off("game:card-dealt");
      socket.off("game:shuffle");
    };
  }, [socket]);

  return state;
}
