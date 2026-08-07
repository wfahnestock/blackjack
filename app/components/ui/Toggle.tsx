interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name. Visible text usually lives beside the switch, not in it. */
  label: string;
}

/**
 * Brass switch.
 *
 * A native checkbox renders as a stock blue-grey box that reads as a form
 * artifact next to the rest of the casino chrome, so the real input is kept for
 * semantics, keyboard and screen readers, and is visually replaced by the
 * track and knob.
 */
export function Toggle({ checked, disabled, onChange, label }: ToggleProps) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={`h-[22px] w-[40px] rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brass)]/50 ${
          checked
            ? "border-[var(--brass)]/70 bg-[var(--brass)]/35"
            : "border-[var(--brass)]/20 bg-black/40"
        } ${disabled ? "opacity-40" : ""}`}
      />
      <span
        className={`pointer-events-none absolute top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full transition-all ${
          checked
            ? "left-[21px] bg-[#f0dca4] shadow-[0_0_6px_rgba(201,162,39,0.6)]"
            : "left-[4px] bg-[#6b6144]"
        } ${disabled ? "opacity-40" : ""}`}
      />
    </span>
  );
}
