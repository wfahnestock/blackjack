import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * SPA-only app, so it is safe to read window.matchMedia during the initial
 * render (no SSR hydration mismatch to worry about).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
