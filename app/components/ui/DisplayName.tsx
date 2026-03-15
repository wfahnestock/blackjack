import { nameEffectClass } from "~/lib/nameEffects";
import { DEVELOPER_ROLE_NAMES } from "~/lib/constants";
import type { RoleInfo } from "~/lib/types";

interface DisplayNameProps {
  displayName: string;
  nameEffect?: string | null;
  /**
   * When provided, a developer role overrides any equipped vanity effect
   * and applies the exclusive glitch style instead.
   */
  roles?: RoleInfo[];
  /** Extra Tailwind classes applied to the wrapping span (typography, truncation, etc.) */
  className?: string;
}

/**
 * Renders a player's display name with their equipped vanity effect applied.
 * Drop-in replacement for bare `{player.displayName}` text nodes wherever
 * the effect should show (player seats, chat, profile modals, leaderboard…).
 *
 * Priority: developer role → equipped vanity effect → plain text.
 */
export function DisplayName({ displayName, nameEffect, roles, className = "" }: DisplayNameProps) {
  const isDev = roles?.some((r) => DEVELOPER_ROLE_NAMES.has(r.name)) ?? false;
  const effectClass = isDev ? "ne-glitch" : nameEffectClass(nameEffect);
  return (
    <span className={[effectClass, className].filter(Boolean).join(" ")}>
      {displayName}
    </span>
  );
}
