import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="casino-eyebrow">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`casino-input w-full px-3 py-2.5 text-[13px] ${
          error ? "!border-red-400/60" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
