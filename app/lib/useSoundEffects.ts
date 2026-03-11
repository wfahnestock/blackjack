import { useEffect, useRef } from "react";
import type { GameState, Hand, Player, RoundResult } from "./types.js";
import { getSocket } from "./socket.js";

type SoundKey = "card_draw" | "shuffle" | "betting_start" | "blackjack";

const SOUND_SRCS: Record<SoundKey, string> = {
  card_draw:     "/sounds/card_draw.mp3",
  shuffle:       "/sounds/shuffle.mp3",
  betting_start: "/sounds/betting_start.mp3",
  blackjack:     "/sounds/blackjack.mp3",
};

export function useSoundEffects(state: GameState | null) {
  const audios = useRef<Record<SoundKey, HTMLAudioElement | null>>({
    card_draw:     null,
    shuffle:       null,
    betting_start: null,
    blackjack:     null,
  });

  const prevPhase = useRef<GameState["phase"] | null>(null);

  // Tracks the last-seen card count per handId so we can detect when a card
  // was actually added (vs. a "stood" update that carries the same cards).
  const handCardCounts = useRef<Map<string, number>>(new Map());

  // Preload all audio files once on mount
  useEffect(() => {
    for (const [key, src] of Object.entries(SOUND_SRCS) as [SoundKey, string][]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audios.current[key] = audio;
    }
  }, []);

  // play() rewinds and fires — silently swallows autoplay-policy errors
  function play(key: SoundKey) {
    const audio = audios.current[key];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {/* browser blocked autoplay — no-op */});
  }

  // betting_start: fire whenever the phase transitions into "betting"
  useEffect(() => {
    if (!state) return;
    if (state.phase === "betting" && prevPhase.current !== "betting") {
      play("betting_start");
    }
    prevPhase.current = state.phase;
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket-driven effects
  useEffect(() => {
    const socket = getSocket();

    // ── Initial deal ──────────────────────────────────────────────────────────
    // game:card-dealt fires for every card during the dealing phase and for
    // dealer draws. The delay field mirrors the card animation timing.
    const onCardDealt = ({ delay }: { delay: number }) => {
      setTimeout(() => play("card_draw"), delay);
    };

    // ── Player hit / double ───────────────────────────────────────────────────
    // The server intentionally skips game:card-dealt for hits/doubles to avoid
    // a double-deal race with state:hand-updated. We detect a new card by
    // comparing the incoming card count to the last count we tracked.
    const onHandUpdated = ({ hand }: { playerId: string; hand: Hand }) => {
      const prev = handCardCounts.current.get(hand.handId);
      if (prev !== undefined && hand.cards.length > prev) {
        play("card_draw");
      }
      handCardCounts.current.set(hand.handId, hand.cards.length);
    };

    // ── Sync / player-updated: seed the count map ─────────────────────────────
    // state:sync fires at the end of the dealing phase (all cards already
    // present). Seeding from it means the first hand-updated for an auto-stand
    // won't incorrectly fire the sound (same count → no change).
    const onSync = (syncedState: GameState) => {
      for (const player of syncedState.players) {
        for (const hand of player.hands) {
          handCardCounts.current.set(hand.handId, hand.cards.length);
        }
      }
    };

    // state:player-updated carries new hands created by splits. Only initialise
    // counts for hands we haven't seen before so we don't overwrite tracking.
    const onPlayerUpdated = (player: Player) => {
      for (const hand of player.hands) {
        if (!handCardCounts.current.has(hand.handId)) {
          handCardCounts.current.set(hand.handId, hand.cards.length);
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

    socket.on("game:card-dealt",     onCardDealt as any);
    socket.on("state:hand-updated",  onHandUpdated as any);
    socket.on("state:sync",          onSync as any);
    socket.on("state:player-updated", onPlayerUpdated as any);
    socket.on("game:shuffle",        onShuffle);
    socket.on("game:round-result",   onRoundResult as any);

    return () => {
      socket.off("game:card-dealt",     onCardDealt as any);
      socket.off("state:hand-updated",  onHandUpdated as any);
      socket.off("state:sync",          onSync as any);
      socket.off("state:player-updated", onPlayerUpdated as any);
      socket.off("game:shuffle",        onShuffle);
      socket.off("game:round-result",   onRoundResult as any);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
