import { useEffect, useRef } from "react";
import type { GameState, Hand, Player, RoundResult } from "./types.js";
import { getSocket } from "./socket.js";

type SoundKey =
  | "card_draw"
  | "shuffle"
  | "betting_start"
  | "dealing_start"
  | "blackjack"
  | "player_hit"
  | "player_stand"
  | "player_bust"
  | "player_double_down";

const SOUND_SRCS: Record<SoundKey, string> = {
  card_draw:          "/sounds/card_draw.mp3",
  shuffle:            "/sounds/shuffle.mp3",
  betting_start:      "/sounds/betting_start.mp3",
  dealing_start:      "/sounds/dealing_start.mp3",
  blackjack:          "/sounds/blackjack.mp3",
  player_hit:         "/sounds/player_hit.mp3",
  player_stand:       "/sounds/player_stand.mp3",
  player_bust:        "/sounds/player_bust.mp3",
  player_double_down: "/sounds/player_double_down.mp3",
};

// Per-hand tracking so we can tell what changed between updates.
interface HandTrack {
  cardCount: number;
  stood:     boolean;
  doubled:   boolean;
}

export function useSoundEffects(state: GameState | null, selfPlayerId: string | null) {
  const audios = useRef<Record<SoundKey, HTMLAudioElement | null>>({
    card_draw:          null,
    shuffle:            null,
    betting_start:      null,
    dealing_start:      null,
    blackjack:          null,
    player_hit:         null,
    player_stand:       null,
    player_bust:        null,
    player_double_down: null,
  });

  const prevPhase      = useRef<GameState["phase"] | null>(null);
  const handState      = useRef<Map<string, HandTrack>>(new Map());

  // Keep selfPlayerId accessible inside the stable socket-effect closure.
  const selfPlayerIdRef = useRef(selfPlayerId);
  useEffect(() => { selfPlayerIdRef.current = selfPlayerId; }, [selfPlayerId]);

  // Preload all audio files once on mount.
  useEffect(() => {
    for (const [key, src] of Object.entries(SOUND_SRCS) as [SoundKey, string][]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audios.current[key] = audio;
    }
  }, []);

  // play() rewinds and fires — silently swallows autoplay-policy errors.
  function play(key: SoundKey) {
    const audio = audios.current[key];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  // Phase-transition sounds: fire once whenever the phase changes to a target.
  useEffect(() => {
    if (!state) return;
    if (state.phase === "betting" && prevPhase.current !== "betting") {
      play("betting_start");
    }
    if (state.phase === "dealing" && prevPhase.current !== "dealing") {
      play("dealing_start");
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
      setTimeout(() => play("card_draw"), delay);
    };

    // ── Player actions ────────────────────────────────────────────────────────
    // The server skips game:card-dealt for hits/doubles to avoid a double-deal
    // race. We infer the action by comparing tracked state with each update.
    const onHandUpdated = ({ playerId, hand }: { playerId: string; hand: Hand }) => {
      const prev        = handState.current.get(hand.handId);
      const cardAdded   = prev !== undefined && hand.cards.length > prev.cardCount;
      const stoodChanged = prev !== undefined && hand.stood && !prev.stood;

      if (cardAdded) {
        if (hand.doubled) {
          play("player_double_down");
        } else if (hand.busted && playerId === selfPlayerIdRef.current) {
          // Bust sound only for the local player so it doesn't overlap across seats.
          play("player_bust");
        } else {
          play("player_hit");
        }
      } else if (stoodChanged) {
        play("player_stand");
      }

      handState.current.set(hand.handId, {
        cardCount: hand.cards.length,
        stood:     hand.stood,
        doubled:   hand.doubled,
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
            stood:     hand.stood,
            doubled:   hand.doubled,
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
            stood:     hand.stood,
            doubled:   hand.doubled,
          });
        }
      }
    };

    // ── Other sounds ──────────────────────────────────────────────────────────
    const onShuffle = () => play("shuffle");

    const onRoundResult = (results: RoundResult[]) => {
      if (results.some((r) => r.result === "blackjack")) {
        play("blackjack");
      }
    };

    socket.on("game:card-dealt",      onCardDealt as any);
    socket.on("state:hand-updated",   onHandUpdated as any);
    socket.on("state:sync",           onSync as any);
    socket.on("state:player-updated", onPlayerUpdated as any);
    socket.on("game:shuffle",         onShuffle);
    socket.on("game:round-result",    onRoundResult as any);

    return () => {
      socket.off("game:card-dealt",      onCardDealt as any);
      socket.off("state:hand-updated",   onHandUpdated as any);
      socket.off("state:sync",           onSync as any);
      socket.off("state:player-updated", onPlayerUpdated as any);
      socket.off("game:shuffle",         onShuffle);
      socket.off("game:round-result",    onRoundResult as any);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
