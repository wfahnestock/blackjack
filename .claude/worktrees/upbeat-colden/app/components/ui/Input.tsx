import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`
          w-full rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-gray-100
          placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
          transition-colors
          ${error ? "border-red-500" : "border-gray-700"}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
