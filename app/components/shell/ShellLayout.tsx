import { Link, useLocation } from "react-router";
import { useAuth } from "~/lib/AuthContext";
import { hasPermission } from "~/lib/permissions";
import { casinoFeltClass } from "~/lib/tableBgs";

/** Nav item in the wood rail. */
function RailLink({
  to,
  icon,
  label,
  accent = false,
  active = false,
}: {
  to: string;
  icon: string;
  label: string;
  accent?: boolean;
  active?: boolean;
}) {
  const tone = accent
    ? "text-[#e8cd7a] hover:text-[#f5e2a6]"
    : active
    ? "text-[var(--parchment)]"
    : "text-[#c2ad80] hover:text-[var(--parchment)]";
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.13em] transition-colors hover:bg-white/5 ${tone} ${
        active ? "bg-white/[0.07]" : ""
      }`}
    >
      <i className={`fa-solid ${icon} text-[10px] opacity-85`} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

interface ShellLayoutProps {
  children: React.ReactNode;
  /**
   * Layout for the content area. Defaults to a top-aligned scrolling page;
   * the home screen overrides this to centre a single viewport of content.
   */
  contentClassName?: string;
}

/**
 * Chrome shared by every page outside the game table: the wood rail plus the
 * felt ground, with the felt tinted by whichever table background the player
 * has equipped.
 *
 * Locked to exactly one viewport height with the content area owning any
 * scrolling, so the rail never drifts and the page itself never scrolls. The
 * content area hides its scrollbar but stays scrollable.
 */
export function ShellLayout({ children, contentClassName }: ShellLayoutProps) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <nav className="casino-rail flex-none">
        <div className="w-full max-w-5xl mx-auto px-5 h-[52px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-baseline gap-2 select-none">
            <span className="text-[var(--brass)] text-base leading-none">♠</span>
            <span className="font-display text-lg text-[var(--parchment)] leading-none">
              Blackjack
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <RailLink to="/locker" icon="fa-gem" label="Locker" active={pathname === "/locker"} />
            <RailLink
              to="/leaderboard"
              icon="fa-trophy"
              label="Leaderboard"
              active={pathname === "/leaderboard"}
            />
            <RailLink
              to="/settings"
              icon="fa-gear"
              label="Settings"
              active={pathname === "/settings"}
            />
            {/* Staff only. The server re-checks on every admin call; this just
                hides the entry point. */}
            {hasPermission(user?.roles, "admin.access") && (
              <RailLink to="/admin" icon="fa-shield-halved" label="Admin" accent />
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.13em] text-[#c2ad80]/60 hover:text-[#e8cd7a] hover:bg-white/5 transition-colors"
            >
              <i className="fa-solid fa-right-from-bracket text-[10px]" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`casino-felt ${casinoFeltClass(
          user?.equippedTableBg
        )} no-scrollbar flex-1 min-h-0 overflow-y-auto ${
          contentClassName ?? "px-4 py-10"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
