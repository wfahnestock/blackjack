import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DealerBehaviorEngine } from "./DealerBehavior.js";
import { dealerShouldHit } from "./HandEvaluator.js";
import { cards, withRandom } from "./testHelpers.js";

describe("DealerBehaviorEngine.shouldHit — deterministic paths", () => {
  test("with the engine disabled, defers to base rules", () => {
    const engine = new DealerBehaviorEngine({ enabled: false });
    assert.equal(engine.shouldHit(cards("10", "6"), 20), dealerShouldHit(cards("10", "6")));
    assert.equal(engine.shouldHit(cards("10", "7"), 20), dealerShouldHit(cards("10", "7")));
    assert.equal(engine.shouldHit(cards("10", "6"), 20), true); // hit 16
    assert.equal(engine.shouldHit(cards("10", "7"), 20), false); // stand hard 17
  });

  test("with fuzzing disabled, defers to base rules", () => {
    const engine = new DealerBehaviorEngine({
      fuzzing: { enabled: false, edgeRangeHitChances: {} },
    });
    assert.equal(engine.shouldHit(cards("10", "7"), 20), false);
    assert.equal(engine.shouldHit(cards("10", "6"), 20), true);
  });

  test("always hits a total below 15, regardless of RNG", () => {
    const engine = new DealerBehaviorEngine();
    assert.equal(withRandom(0.99, () => engine.shouldHit(cards("10", "4"), 20)), true); // 14
  });

  test("always stands on a total above 18, regardless of RNG", () => {
    const engine = new DealerBehaviorEngine();
    assert.equal(withRandom(0.0, () => engine.shouldHit(cards("10", "9"), 20)), false); // 19
  });

  test("never hits a hard 17", () => {
    const engine = new DealerBehaviorEngine();
    assert.equal(withRandom(0.0, () => engine.shouldHit(cards("10", "7"), 20)), false);
  });

  test("always hits a soft 17", () => {
    const engine = new DealerBehaviorEngine();
    assert.equal(withRandom(0.99, () => engine.shouldHit(cards("A", "6"), 20)), true);
  });
});

describe("DealerBehaviorEngine.shouldHit — probabilistic edge (15/16)", () => {
  test("hard 15 hits about 90% of the time", () => {
    const engine = new DealerBehaviorEngine();
    // Low player total so bust-bias does not apply.
    assert.equal(withRandom(0.5, () => engine.shouldHit(cards("10", "5"), 10)), true); // 0.5 < 0.90
    assert.equal(withRandom(0.95, () => engine.shouldHit(cards("10", "5"), 10)), false); // 0.95 >= 0.90
  });

  test("hard 16 hits about 85% of the time", () => {
    const engine = new DealerBehaviorEngine();
    assert.equal(withRandom(0.8, () => engine.shouldHit(cards("10", "6"), 10)), true); // 0.8 < 0.85
    assert.equal(withRandom(0.9, () => engine.shouldHit(cards("10", "6"), 10)), false); // 0.9 >= 0.85
  });

  test("bust-bias raises the hit chance on 16 when a player holds a strong total", () => {
    const engine = new DealerBehaviorEngine();
    // Weak player total: base 0.85 chance, so RNG 0.90 stands.
    assert.equal(withRandom(0.9, () => engine.shouldHit(cards("10", "6"), 10)), false);
    // Strong player total (>= 18): chance becomes 0.85 + 0.08 = 0.93, so 0.90 now hits.
    assert.equal(withRandom(0.9, () => engine.shouldHit(cards("10", "6"), 20)), true);
  });
});
