/**
 * ngrok browser-warning bypass.
 *
 * On ngrok's free tier, requests that look like they came from a browser get an
 * HTML interstitial ("You are about to visit...") instead of the real response.
 * For the page load that's just an extra click, but for `fetch` it's fatal: the
 * API returns HTML where the app expects JSON, so every call fails. Sending the
 * `ngrok-skip-browser-warning` header (any value) suppresses the interstitial.
 *
 * Rather than thread this through ~15 fetch call sites (and every future one),
 * we install it once on window.fetch. The header is only added to same-origin
 * requests, so we never attach a custom header to a cross-origin call and
 * accidentally trigger a CORS preflight. On a non-ngrok host the extra header is
 * simply ignored, so this is safe to leave on in every environment.
 */

export const NGROK_HEADER = "ngrok-skip-browser-warning";
/** ngrok only checks for the header's presence; the value is arbitrary. */
export const NGROK_HEADER_VALUE = "true";

let installed = false;

function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    // Relative URLs ("/api/...") resolve to our own origin.
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Patches window.fetch so every same-origin request carries the header. Idempotent. */
export function installNgrokHeader(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isSameOrigin(input)) return originalFetch(input, init);

    // Merge onto whichever header source applies, so we never drop existing
    // headers (Authorization, Content-Type) set by the caller.
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    headers.set(NGROK_HEADER, NGROK_HEADER_VALUE);

    return originalFetch(input, { ...init, headers });
  };
}
