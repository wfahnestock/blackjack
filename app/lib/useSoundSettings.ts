import { useCallback, useSyncExternalStore } from "react";
import { sounds, type ChipSound } from "./soundManager.js";

/**
 * Reactive view of the global sound preferences. Backed by the SoundManager
 * singleton (not React state) so that non-React callers — the button click
 * helper, the game sound hook — share the exact same mute/volume values.
 */
export function useSoundSettings() {
  const subscribe = useCallback((cb: () => void) => sounds.subscribe(cb), []);

  const muted = useSyncExternalStore(
    subscribe,
    () => sounds.muted,
    () => false // server snapshot; audio is client-only
  );
  const volume = useSyncExternalStore(
    subscribe,
    () => sounds.volume,
    () => 0.7
  );
  const tableSounds = useSyncExternalStore(
    subscribe,
    () => sounds.tableSounds,
    () => true // default: other players' actions are audible
  );

  const chipSound = useSyncExternalStore(
    subscribe,
    () => sounds.chipSound,
    () => "clink" as ChipSound
  );

  return {
    muted,
    volume,
    tableSounds,
    chipSound,
    setTableSounds: (v: boolean) => {
      sounds.tableSounds = v;
    },
    /** Selects a chip sound and immediately plays it so it can be compared. */
    setChipSound: (v: ChipSound) => {
      sounds.chipSound = v;
      sounds.playChipPreview(v);
    },
    previewChip: (v: ChipSound) => sounds.playChipPreview(v),
    setMuted: (v: boolean) => {
      sounds.muted = v;
    },
    toggleMuted: () => {
      sounds.muted = !sounds.muted;
    },
    setVolume: (v: number) => {
      sounds.volume = v;
    },
    /** Plays a short sample so the user can hear the level they just picked. */
    preview: () => sounds.play("chips"),
  };
}
