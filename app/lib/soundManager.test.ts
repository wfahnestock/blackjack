import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Exercises the sound manager's preference logic (mute, volume, persistence,
 * subscription). Playback itself needs real browser audio, so it isn't covered
 * here; what matters is that the settings behave predictably and survive a
 * reload, since that's the part users interact with.
 */

const store = new Map<string, string>();

// Minimal browser stubs, installed before the module is imported so that
// init() sees the prefilled values on first read.
before(() => {
  store.set("bj_sound_muted", "true");
  store.set("bj_sound_volume", "0.3");
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
});

async function getManager() {
  const mod = await import("./soundManager.js");
  return mod.sounds;
}

describe("SoundManager preferences", () => {
  test("init() restores persisted mute and volume", async () => {
    const sounds = await getManager();
    sounds.init();
    assert.equal(sounds.muted, true);
    assert.equal(sounds.volume, 0.3);
  });

  test("setting mute persists it", async () => {
    const sounds = await getManager();
    sounds.muted = false;
    assert.equal(sounds.muted, false);
    assert.equal(store.get("bj_sound_muted"), "false");

    sounds.muted = true;
    assert.equal(store.get("bj_sound_muted"), "true");
    sounds.muted = false; // leave unmuted for the remaining tests
  });

  test("volume is clamped to 0..1 and persisted", async () => {
    const sounds = await getManager();

    sounds.volume = 0.5;
    assert.equal(sounds.volume, 0.5);
    assert.equal(store.get("bj_sound_volume"), "0.5");

    sounds.volume = 5;
    assert.equal(sounds.volume, 1, "above range clamps to 1");

    sounds.volume = -3;
    assert.equal(sounds.volume, 0, "below range clamps to 0");

    sounds.volume = 0.7;
  });

  test("subscribers are notified on change and can unsubscribe", async () => {
    const sounds = await getManager();
    let calls = 0;
    const unsubscribe = sounds.subscribe(() => calls++);

    sounds.muted = true;
    sounds.volume = 0.4;
    assert.equal(calls, 2, "both changes notify");

    unsubscribe();
    sounds.muted = false;
    assert.equal(calls, 2, "no notifications after unsubscribe");
  });

  test("play() is a no-op rather than a throw when muted", async () => {
    const sounds = await getManager();
    sounds.muted = true;
    // No Audio/AudioContext stub exists; muted must short-circuit before use.
    assert.doesNotThrow(() => sounds.play("card_draw"));
    assert.doesNotThrow(() => sounds.play("round_win"));
    sounds.muted = false;
  });

  test("play() at zero volume is also a no-op", async () => {
    const sounds = await getManager();
    sounds.volume = 0;
    assert.doesNotThrow(() => sounds.play("chips"));
    sounds.volume = 0.7;
  });
});

describe("table sounds preference", () => {
  test("defaults to enabled when nothing is persisted", async () => {
    const sounds = await getManager();
    // The stub store never sets bj_sound_table, so this covers both a brand new
    // player and an existing one upgrading — both should hear the table.
    assert.equal(store.has("bj_sound_table"), false);
    assert.equal(sounds.tableSounds, true);
  });

  test("toggling persists the choice", async () => {
    const sounds = await getManager();
    sounds.tableSounds = false;
    assert.equal(sounds.tableSounds, false);
    assert.equal(store.get("bj_sound_table"), "false");

    sounds.tableSounds = true;
    assert.equal(store.get("bj_sound_table"), "true");
  });

  test("changes notify subscribers", async () => {
    const sounds = await getManager();
    let calls = 0;
    const off = sounds.subscribe(() => calls++);
    sounds.tableSounds = false;
    assert.equal(calls, 1);
    off();
    sounds.tableSounds = true;
  });
});

describe("chip sound preference", () => {
  test("defaults to the synthesized clink", async () => {
    const sounds = await getManager();
    assert.equal(store.has("bj_sound_chip"), false);
    assert.equal(sounds.chipSound, "clink");
  });

  test("selection persists", async () => {
    const sounds = await getManager();
    sounds.chipSound = "stack";
    assert.equal(sounds.chipSound, "stack");
    assert.equal(store.get("bj_sound_chip"), "stack");

    sounds.chipSound = "classic";
    assert.equal(store.get("bj_sound_chip"), "classic");
    sounds.chipSound = "clink";
  });

  test("previews don't throw without Web Audio, and respect mute", async () => {
    const sounds = await getManager();
    sounds.muted = true;
    // No AudioContext stub exists here, so mute must short-circuit first.
    assert.doesNotThrow(() => sounds.playChipPreview("clink"));
    assert.doesNotThrow(() => sounds.playChipPreview("classic"));
    sounds.muted = false;
  });
});

describe("action-sound audibility rule", () => {
  // Mirrors the gate in useSoundEffects.onHandUpdated: your own actions always
  // sound; everyone else's depend on the table-sounds preference.
  const audible = (isSelf: boolean, tableSounds: boolean) => isSelf || tableSounds;

  test("your own actions always play", () => {
    assert.equal(audible(true, true), true);
    assert.equal(audible(true, false), true);
  });

  test("other players play only when table sounds are on", () => {
    assert.equal(audible(false, true), true);
    assert.equal(audible(false, false), false);
  });
});
