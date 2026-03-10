import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-500 shadow-lg shadow-emerald-900/30",
  secondary:
    "bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-gray-100 border border-gray-600",
  ghost:
    "bg-transparent hover:bg-gray-800 active:bg-gray-700 text-gray-300 border border-gray-700",
  danger:
    "bg-red-700 hover:bg-red-600 active:bg-red-800 text-white border border-red-600",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-all duration-150 cursor-pointer select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
