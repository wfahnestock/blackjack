import { useEffect, useRef } from "react";
import type { GameState, Hand, Player, RoundResult } from "./types.js";
import { getSocket } from "./socket.js";
import { sounds, playSound } from "./soundManager.js";

// Per-hand tracking so we can tell what changed between updates.
interface HandTrack {
  cardCount: number;
  stood: boolean;
  doubled: boolean;
}

function isWinResult(r: RoundResult["result"]): boolean {
  return r === "win" || r === "blackjack" || r === "five-card-charlie";
}

export function useSoundEffects(state: GameState | null, selfPlayerId: string | null) {
  const prevPhase = useRef<GameState["phase"] | null>(null);
  const handState = useRef<Map<string, HandTrack>>(new Map());

  // Keep selfPlayerId accessible inside the stable socket-effect closure.
  const selfPlayerIdRef = useRef(selfPlayerId);
  useEffect(() => {
    selfPlayerIdRef.current = selfPlayerId;
  }, [selfPlayerId]);

  // Build the audio pools once. Playback, mute and volume all live in the
  // shared sound manager so these respect the user's settings.
  useEffect(() => {
    sounds.preload();
  }, []);

  // Phase-transition sounds: fire once whenever the phase changes to a target.
  useEffect(() => {
    if (!state) return;
    if (state.phase === "betting" && prevPhase.current !== "betting") {
      playSound("betting_start");
    }
    if (state.phase === "dealing" && prevPhase.current !== "dealing") {
      playSound("dealing_start");
    }
    prevPhase.current = state.phase;
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket-driven effects (stable — registered once, uses refs for current values).
  useEffect(() => {
    const socket = getSocket();

    // ── Initial deal + dealer draws ───────────────────────────────────────────
    // game:card-dealt fires for every card during the dealing phase and for
    // dealer draws. The delay field mirrors the card animation timing.
    const onCardDealt = ({ delay }: { delay: number }) => {
      setTimeout(() => playSound("card_draw"), delay);
    };

    // ── Player actions ────────────────────────────────────────────────────────
    // The server skips game:card-dealt for hits/doubles to avoid a double-deal
    // race. We infer the action by comparing tracked state with each update.
    //
    // By design these are audible for every seat, so the table feels alive.
    // Players who find a busy table noisy can turn off "table sounds", which
    // limits action audio to their own seat.
    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      const prev = handState.current.get(hand.handId);
      const cardAdded = prev !== undefined && hand.cards.length > prev.cardCount;
      const stoodChanged = prev !== undefined && hand.stood && !prev.stood;
      const isSelf = playerId === selfPlayerIdRef.current;

      if (isSelf || sounds.tableSounds) {
        if (cardAdded) {
          if (hand.doubled) {
            playSound("player_double_down");
          } else if (hand.fiveCardCharlie) {
            playSound("player_5card");
          } else if (hand.busted && isSelf) {
            // The bust sting stays personal; another seat busting reads as a
            // hit, which keeps stings from stacking across seats.
            playSound("player_bust");
          } else {
            playSound("player_hit");
          }
        } else if (stoodChanged) {
          playSound("player_stand");
        }
      }

      // Tracking is updated regardless of whether anything was audible.
      handState.current.set(hand.handId, {
        cardCount: hand.cards.length,
        stood: hand.stood,
        doubled: hand.doubled,
      });
    };

    // ── Seed the tracking map ─────────────────────────────────────────────────
    // state:sync fires at the end of the dealing phase with all cards present.
    // Seeding here prevents the first hand-updated (e.g. auto-stand on BJ)
    // from incorrectly triggering sounds.
    const onSync = (syncedState: GameState) => {
      for (const player of syncedState.players) {
        for (const hand of player.hands) {
          handState.current.set(hand.handId, {
            cardCount: hand.cards.length,
            stood: hand.stood,
            doubled: hand.doubled,
          });
        }
      }
    };

    // state:player-updated carries newly split hands — only initialise hands
    // we haven't seen to avoid overwriting in-progress tracking.
    const onPlayerUpdated = (player: Player) => {
      for (const hand of player.hands) {
        if (!handState.current.has(hand.handId)) {
          handState.current.set(hand.handId, {
            cardCount: hand.cards.length,
            stood: hand.stood,
            doubled: hand.doubled,
          });
        }
      }
    };

    // ── Other sounds ──────────────────────────────────────────────────────────
    const onShuffle = () => playSound("shuffle");

    /**
     * Round outcome feedback. Any natural at the table rings out (the original
     * behaviour), while win/lose/push tones are personal — they report *your*
     * result, so they'd be meaningless for someone else's hand.
     */
    const onRoundResult = (results: RoundResult[]) => {
      const selfId = selfPlayerIdRef.current;
      const mine = results.filter((r) => r.playerId === selfId);
      const iGotBlackjack = mine.some((r) => r.result === "blackjack");
      const anyBlackjack = results.some((r) => r.result === "blackjack");

      // Mine always sounds; someone else's only when table sounds are on.
      if (iGotBlackjack || (sounds.tableSounds && anyBlackjack)) {
        playSound("blackjack");
      }

      // My own blackjack already had its sting, so don't stack a tone on top.
      if (mine.length === 0 || iGotBlackjack) return;

      // Across split hands, a single win is enough to call the round a win.
      if (mine.some((r) => isWinResult(r.result))) playSound("round_win");
      else if (mine.every((r) => r.result === "push")) playSound("round_push");
      else playSound("round_lose");
    };

    const onAchievementUnlocked = () => playSound("applaud");

    socket.on("game:card-dealt", onCardDealt as any);
    socket.on("state:hand-updated", onHandUpdated as any);
    socket.on("state:sync", onSync as any);
    socket.on("state:player-updated", onPlayerUpdated);
    socket.on("game:shuffle", onShuffle);
    socket.on("game:round-result", onRoundResult as any);
    socket.on("achievement:unlocked", onAchievementUnlocked as any);

    return () => {
      socket.off("game:card-dealt", onCardDealt as any);
      socket.off("state:hand-updated", onHandUpdated as any);
      socket.off("state:sync", onSync as any);
      socket.off("state:player-updated", onPlayerUpdated);
      socket.off("game:shuffle", onShuffle);
      socket.off("game:round-result", onRoundResult as any);
      socket.off("achievement:unlocked", onAchievementUnlocked as any);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
