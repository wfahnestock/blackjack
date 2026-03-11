// Singleton audio instance for button-click feedback.
// Module-level so it persists across renders without a React context.

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio("/sounds/button_click.mp3");
    audio.preload = "auto";
  }
  return audio;
}

export function playButtonClick(): void {
  const a = getAudio();
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {});
}
