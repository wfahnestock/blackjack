import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

/* Maps onto the shared casino tokens in app.css so every button in the app
   (lobby, login, register, modals) shares one palette. */
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-brass",
  secondary: "btn-brass-ghost",
  ghost:
    "bg-transparent border border-transparent text-[var(--parchment-dim)] hover:text-[var(--parchment)] hover:bg-white/[0.05]",
  danger: "btn-danger",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-[13px]",
  lg: "px-6 py-3 text-[13.5px] uppercase tracking-[0.09em]",
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
        inline-flex items-center justify-center gap-2 rounded-md font-bold
        transition-all duration-150 cursor-pointer select-none
        disabled:cursor-not-allowed
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
