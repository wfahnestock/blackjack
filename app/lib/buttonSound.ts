import { playSound } from "./soundManager.js";

/**
 * UI click feedback. Kept as a named helper because it's called from a dozen
 * button handlers; the actual playback (and mute/volume) lives in the shared
 * sound manager so this respects the user's settings like everything else.
 */
export function playButtonClick(): void {
  playSound("button_click");
}

/** Chip-specific click, used when adding to a bet. */
export function playChipClick(): void {
  playSound("chips");
}
