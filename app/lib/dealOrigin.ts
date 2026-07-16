import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * A ref to the shoe's dealing-slot element. Cards read it as the origin point
 * for their entrance animation so they look like they're being drawn from the
 * shoe. Provided by GameTable (wide layout only); null everywhere else.
 */
export const DealOriginContext = createContext<RefObject<HTMLElement | null> | null>(null);

/**
 * FLIP-style entrance: when `enabled`, a freshly-mounted card starts at the
 * shoe's dealing slot and slides to its resting position, so dealt cards look
 * like they're drawn from the shoe. Returns a ref to attach to the card's
 * outer element.
 *
 * Falls back to the CSS `card-appear` animation (left intact on the element)
 * whenever there's no shoe on screen — e.g. the mobile layout, where the origin
 * ref is absent. The effect runs once per mount; since hands render cards with
 * a stable key, only a newly-dealt card mounts, so each one animates in turn.
 *
 * Robust to React StrictMode's dev-only mount→unmount→mount double-invoke: the
 * cleanup fully resets the inline styles, and the effect clears any leftover
 * transform *before* measuring, so a cancelled first pass can't leave the card
 * parked at the shoe and make the second pass measure a zero-length trip.
 */
export function useDealFlyIn<T extends HTMLElement = HTMLDivElement>(enabled: boolean) {
  const originRef = useContext(DealOriginContext);
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const origin = originRef?.current;
    if (!el || !origin) return; // no shoe → keep the CSS card-appear fallback

    const o = origin.getBoundingClientRect();
    if (!o.width && !o.height) return; // origin not laid out yet

    // Clear any leftover transform (e.g. from a cancelled StrictMode pass) so we
    // measure the card's true resting position, not a parked-at-the-shoe one.
    el.style.transform = "";
    const s = el.getBoundingClientRect();
    const dx = o.left + o.width / 2 - (s.left + s.width / 2);
    const dy = o.top + o.height / 2 - (s.top + s.height / 2);

    // Suppress the CSS appear animation and jump the card back to the shoe...
    el.style.animation = "none";
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.6) rotate(-9deg)`;
    el.style.willChange = "transform";
    void el.offsetWidth; // force reflow so the start frame commits

    // ...then let it settle into place on the next frame.
    const raf = requestAnimationFrame(() => {
      el.style.transition = "transform 0.42s cubic-bezier(0.2, 0.7, 0.3, 1)";
      el.style.transform = "translate(0, 0) scale(1) rotate(0deg)";
    });

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("transitionend", onEnd);
      // Fully reset so a cancelled pass can't leave the card displaced or its
      // transform lingering into a re-mount.
      el.style.transition = "";
      el.style.transform = "";
      el.style.animation = "";
      el.style.willChange = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return ref;
}
