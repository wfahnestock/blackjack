/**
 * Central sound manager.
 *
 * Replaces the two independent audio paths that existed before (a singleton
 * <audio> for button clicks, and a separate preload/play block inside the game
 * sound hook). Everything now goes through one module so that:
 *
 *  - master mute + volume apply to every sound, and persist across sessions;
 *  - rapid re-triggers overlap instead of cutting themselves off (each key gets
 *    a small pool of elements rather than one shared element that gets rewound);
 *  - round-result feedback exists without shipping new audio assets — win/lose/
 *    push are synthesized as short tones through the Web Audio API.
 *
 * The server never sees any of this; it's purely client-side presentation.
 */

export type SoundKey =
  // File-backed (public/sounds)
  | "button_click"
  | "chips"
  | "card_draw"
  | "shuffle"
  | "betting_start"
  | "dealing_start"
  | "blackjack"
  | "player_hit"
  | "player_stand"
  | "player_bust"
  | "player_double_down"
  | "player_5card"
  | "applaud"
  // Synthesized (no asset needed)
  | "round_win"
  | "round_lose"
  | "round_push";

const FILE_SOURCES: Partial<Record<SoundKey, string>> = {
  button_click: "/sounds/button_click.mp3",
  chips: "/sounds/chips.mp3",
  card_draw: "/sounds/card_draw.mp3",
  shuffle: "/sounds/shuffle.mp3",
  betting_start: "/sounds/betting_start.mp3",
  dealing_start: "/sounds/dealing_start.mp3",
  blackjack: "/sounds/blackjack.mp3",
  player_hit: "/sounds/player_hit.mp3",
  player_stand: "/sounds/player_stand.mp3",
  player_bust: "/sounds/player_bust.mp3",
  player_double_down: "/sounds/player_double_down.mp3",
  player_5card: "/sounds/player_5card.mp3",
  applaud: "/sounds/applaud.mp3",
};

interface Tone {
  /** Frequency in Hz. */
  f: number;
  /** Duration in seconds. */
  d: number;
  type?: OscillatorType;
}

/**
 * Short tone sequences for round outcomes. Deliberately understated: these fire
 * every single round, so they're quiet and brief rather than celebratory.
 * If you later drop real win/lose/push mp3s into public/sounds, add them to
 * FILE_SOURCES and they'll take priority automatically.
 */
const TONE_SOURCES: Partial<Record<SoundKey, Tone[]>> = {
  round_win: [
    { f: 523.25, d: 0.08 }, // C5
    { f: 783.99, d: 0.13 }, // G5 — rising = good
  ],
  round_lose: [
    { f: 311.13, d: 0.1 }, // Eb4
    { f: 207.65, d: 0.16 }, // Ab3 — falling = bad
  ],
  round_push: [{ f: 440, d: 0.11 }], // A4, single flat note = neutral
};

/**
 * Chip-click variants.
 *
 * A real chip is a short broadband tick with a bit of clay/ceramic resonance,
 * which synthesizes convincingly as a filtered noise burst plus an optional
 * high partial. Doing it procedurally (rather than one fixed sample) matters:
 * every playback is very slightly different in pitch and level, and that
 * variation is the main reason a sound repeated dozens of times per session
 * stops grating.
 */
export type ChipSound = "clink" | "stack" | "tick" | "classic";

interface ChipVariant {
  label: string;
  /** Bandpass centre for the noise burst, Hz. */
  freq: number;
  /** Bandpass resonance. Higher = more pitched / metallic. */
  q: number;
  /** Decay time, seconds. */
  decay: number;
  /** Relative level. */
  gain: number;
  /** Optional resonant partial layered on top, Hz. */
  ping?: number;
}

export const CHIP_VARIANTS: Record<Exclude<ChipSound, "classic">, ChipVariant> = {
  // Bright ceramic click — closest to a single chip tossed onto felt.
  clink: { label: "Clink", freq: 3200, q: 2.2, decay: 0.055, gain: 0.5, ping: 5400 },
  // Lower and rounder, like a chip settling onto a stack.
  stack: { label: "Stack", freq: 1300, q: 1.4, decay: 0.085, gain: 0.55 },
  // Very short and dry. The most understated option for heavy betting.
  tick: { label: "Tick", freq: 5200, q: 4, decay: 0.028, gain: 0.4 },
};

/** How many overlapping instances each file-backed sound may play at once. */
const POOL_SIZE = 3;

const MUTED_KEY = "bj_sound_muted";
const VOLUME_KEY = "bj_sound_volume";
const TABLE_KEY = "bj_sound_table";
const CHIP_KEY = "bj_sound_chip";

type Listener = () => void;

class SoundManager {
  private pools = new Map<SoundKey, HTMLAudioElement[]>();
  private cursor = new Map<SoundKey, number>();
  private ctx: AudioContext | null = null;
  private listeners = new Set<Listener>();
  private loaded = false;

  private _muted = false;
  private _volume = 0.7;
  /**
   * Whether other players' action sounds are audible. On by default: hearing
   * the table react is part of the intended feel. Turning it off limits action
   * audio to your own seat, which helps at a busy table.
   */
  private _tableSounds = true;
  /** Which chip-click sound to use when adding to a bet. */
  private _chipSound: ChipSound = "clink";

  /** Reads persisted preferences. Safe to call repeatedly; no-ops on the server. */
  init(): void {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      const m = window.localStorage.getItem(MUTED_KEY);
      if (m !== null) this._muted = m === "true";
      const v = window.localStorage.getItem(VOLUME_KEY);
      if (v !== null) {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) this._volume = Math.min(1, Math.max(0, parsed));
      }
      // Absent key keeps the default (enabled), so existing players are opted in.
      const t = window.localStorage.getItem(TABLE_KEY);
      if (t !== null) this._tableSounds = t === "true";
      const c = window.localStorage.getItem(CHIP_KEY);
      if (c === "clink" || c === "stack" || c === "tick" || c === "classic") {
        this._chipSound = c;
      }
    } catch {
      /* localStorage can throw in private mode; defaults are fine */
    }
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    this.persist(MUTED_KEY, String(value));
    this.applyVolume();
    this.emit();
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.min(1, Math.max(0, value));
    this.persist(VOLUME_KEY, String(this._volume));
    this.applyVolume();
    this.emit();
  }

  get tableSounds(): boolean {
    this.init();
    return this._tableSounds;
  }

  set tableSounds(value: boolean) {
    this._tableSounds = value;
    this.persist(TABLE_KEY, String(value));
    this.emit();
  }

  get chipSound(): ChipSound {
    this.init();
    return this._chipSound;
  }

  set chipSound(value: ChipSound) {
    this._chipSound = value;
    this.persist(CHIP_KEY, value);
    this.emit();
  }

  /** Subscribe to preference changes (used by the React hook). */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private persist(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  private applyVolume(): void {
    for (const pool of this.pools.values()) {
      for (const el of pool) el.volume = this.effectiveVolume();
    }
  }

  private effectiveVolume(): number {
    return this._muted ? 0 : this._volume;
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /** Creates the element pools. Call once the app has mounted. */
  preload(): void {
    if (typeof window === "undefined") return;
    this.init();
    for (const [key, src] of Object.entries(FILE_SOURCES) as [SoundKey, string][]) {
      if (this.pools.has(key)) continue;
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const el = new Audio(src);
        el.preload = "auto";
        el.volume = this.effectiveVolume();
        pool.push(el);
      }
      this.pools.set(key, pool);
      this.cursor.set(key, 0);
    }
  }

  play(key: SoundKey): void {
    // Load prefs before the mute check: a click on a page that never calls
    // preload() (home, settings) would otherwise use defaults and play out
    // loud for someone who had muted.
    this.init();
    if (this._muted || this._volume === 0 || typeof window === "undefined") return;

    // The chip click is synthesized unless the player picked the original file,
    // so repeated bets get natural variation instead of an identical sample.
    if (key === "chips" && this._chipSound !== "classic") {
      this.playChip(CHIP_VARIANTS[this._chipSound]);
      return;
    }

    if (FILE_SOURCES[key]) {
      this.playFile(key);
      return;
    }
    const tones = TONE_SOURCES[key];
    if (tones) this.playTones(tones);
  }

  /** Plays a specific chip variant regardless of the saved preference (previews). */
  playChipPreview(variant: ChipSound): void {
    this.init();
    if (this._muted || this._volume === 0 || typeof window === "undefined") return;
    if (variant === "classic") this.playFile("chips");
    else this.playChip(CHIP_VARIANTS[variant]);
  }

  /** Cached white-noise buffer; the raw material for the chip click. */
  private noise: AudioBuffer | null = null;

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noise && this.noise.sampleRate === ctx.sampleRate) return this.noise;
    const length = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  private playChip(v: ChipVariant): void {
    try {
      this.ctx ??= new (window.AudioContext ||
        (window as any).webkitAudioContext)() as AudioContext;
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      // Small per-hit randomness. This is what keeps a sound you hear dozens of
      // times a session from becoming fatiguing.
      const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

      const src = ctx.createBufferSource();
      src.buffer = this.getNoise(ctx);
      src.playbackRate.value = jitter(0.12);

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = v.freq * jitter(0.09);
      band.Q.value = v.q;

      const gain = ctx.createGain();
      const peak = Math.max(this.effectiveVolume() * v.gain * jitter(0.18), 0.0002);
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + v.decay);

      src.connect(band).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + v.decay + 0.02);

      // Optional resonant partial: the bit of "ring" a clay chip has.
      if (v.ping) {
        const osc = ctx.createOscillator();
        const oGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = v.ping * jitter(0.07);
        const oPeak = Math.max(peak * 0.35, 0.0002);
        oGain.gain.setValueAtTime(oPeak, now);
        oGain.gain.exponentialRampToValueAtTime(0.0001, now + v.decay * 0.8);
        osc.connect(oGain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + v.decay + 0.02);
      }
    } catch {
      /* Web Audio unavailable — fall back to silence rather than breaking bets */
    }
  }

  private playFile(key: SoundKey): void {
    let pool = this.pools.get(key);
    if (!pool) {
      this.preload();
      pool = this.pools.get(key);
      if (!pool) return;
    }

    // Prefer an idle element so a burst of the same sound layers naturally
    // instead of restarting one element (the old cut-off behaviour).
    let el = pool.find((a) => a.paused || a.ended);
    if (!el) {
      const idx = this.cursor.get(key) ?? 0;
      el = pool[idx % pool.length];
      this.cursor.set(key, idx + 1);
    }

    el.volume = this.effectiveVolume();
    try {
      el.currentTime = 0;
    } catch {
      /* some browsers throw if metadata isn't loaded yet */
    }
    void el.play().catch(() => {
      /* autoplay policy — ignore until the user has interacted */
    });
  }

  private playTones(tones: Tone[]): void {
    try {
      this.ctx ??= new (window.AudioContext ||
        (window as any).webkitAudioContext)() as AudioContext;
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();

      let at = ctx.currentTime;
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone.type ?? "sine";
        osc.frequency.value = tone.f;

        // Short attack/release envelope so it doesn't click.
        const peak = this.effectiveVolume() * 0.25;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.d);

        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + tone.d + 0.02);
        at += tone.d;
      }
    } catch {
      /* Web Audio unavailable — round feedback is optional */
    }
  }
}

export const sounds = new SoundManager();

// Restore saved preferences as soon as the module loads in a browser, so the
// first read of `muted`/`volume` (e.g. the mute button's icon) is already
// correct rather than showing defaults until something plays. No-ops on the server.
sounds.init();

/** Convenience wrapper kept so existing call sites read naturally. */
export function playSound(key: SoundKey): void {
  sounds.play(key);
}
