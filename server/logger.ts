/**
 * Server logging.
 *
 * installConsoleTimestamps() wraps the global console so every log line — the
 * ~60 existing `console.log("[tag] ...")` call sites and any new ones — is
 * prefixed with a local timestamp and a level. Colorized on an interactive
 * terminal; plain text when piped to a file or when NO_COLOR is set, so log
 * files stay clean.
 *
 * `log` is a small helper for new, intentionally-logged events. It just formats
 * `[tag] message` and routes through the (patched) console, so it inherits the
 * same timestamp and level. Use log.info for lifecycle/audit events, log.warn
 * for recoverable oddities, log.error for failures.
 */

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const TAG_COLOR = "\x1b[35m"; // magenta
const LEVEL_COLOR: Record<string, string> = {
  INFO: "\x1b[36m", // cyan
  WARN: "\x1b[33m", // yellow
  ERROR: "\x1b[31m", // red
  DEBUG: "\x1b[90m", // gray
};

const useColor = Boolean(process.stdout.isTTY) && process.env.NO_COLOR == null;

/** Local timestamp: `YYYY-MM-DD HH:mm:ss.SSS`. */
function timestamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
  );
}

function prefix(level: keyof typeof LEVEL_COLOR): string {
  const ts = timestamp();
  const lvl = level.padEnd(5);
  if (!useColor) return `${ts} ${lvl}`;
  return `${DIM}${ts}${RESET} ${LEVEL_COLOR[level]}${lvl}${RESET}`;
}

let installed = false;

export function installConsoleTimestamps(): void {
  if (installed) return;
  installed = true;

  const native = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => native.log(prefix("INFO"), ...args);
  console.info = (...args: unknown[]) => native.info(prefix("INFO"), ...args);
  console.warn = (...args: unknown[]) => native.warn(prefix("WARN"), ...args);
  console.error = (...args: unknown[]) => native.error(prefix("ERROR"), ...args);
  console.debug = (...args: unknown[]) => native.debug(prefix("DEBUG"), ...args);
}

function tag(name: string): string {
  return useColor ? `${TAG_COLOR}[${name}]${RESET}` : `[${name}]`;
}

export const log = {
  info: (name: string, message: string, ...extra: unknown[]) =>
    console.log(`${tag(name)} ${message}`, ...extra),
  warn: (name: string, message: string, ...extra: unknown[]) =>
    console.warn(`${tag(name)} ${message}`, ...extra),
  error: (name: string, message: string, ...extra: unknown[]) =>
    console.error(`${tag(name)} ${message}`, ...extra),
};
