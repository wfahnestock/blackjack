import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { DisplayName } from "./DisplayName";
import { useAuth } from "~/lib/AuthContext";
import { formatChips } from "~/lib/handUtils";
import { hasAnyPermission, hasPermission, type Permission } from "~/lib/permissions";
import type { RoleInfo, AchievementInfo, AchievementCategory } from "~/lib/types";

interface PlayerProfile {
  playerId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  nameEffect: string | null;
  chips: number;
  roles: RoleInfo[];
  stats: {
    handsPlayed: number;
    handsWon: number;
    handsLost: number;
    handsPushed: number;
    blackjacks: number;
    totalWagered: number;
    netWinnings: number;
    biggestWin: number;
    biggestBet: number;
    splitsMade: number;
    doublesMade: number;
    timesBusted: number;
  };
}

type ProfileTab = "stats" | "achievements" | "admin";

/** Moderation state of the viewed player, loaded only for staff. */
interface AdminState {
  bannedAt: string | null;
  banReason: string | null;
  mutedUntil: string | null;
}

/** Actions surfaced in the in-game admin tab, each behind its own permission. */
const QUICK_ACTION_PERMISSIONS: Permission[] = [
  "player.kick",
  "player.mute",
  "player.ban",
  "player.unban",
  "player.adjust_chips",
];

interface ProfileModalProps {
  playerId: string | null;
  onClose: () => void;
  /** The viewer's own id, so we never offer admin actions against yourself. */
  selfPlayerId?: string | null;
}

export function ProfileModal({ playerId, onClose, selfPlayerId }: ProfileModalProps) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [achievements, setAchievements] = useState<AchievementInfo[] | null>(null);
  const [tab, setTab] = useState<ProfileTab>("stats");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminState, setAdminState] = useState<AdminState | null>(null);

  const isSelf = Boolean(playerId && selfPlayerId && playerId === selfPlayerId);
  // Staff-only, and never against yourself. The server re-checks every call;
  // this only decides whether the tab renders.
  const showAdminTab =
    !isSelf &&
    hasPermission(user?.roles, "admin.access") &&
    hasAnyPermission(user?.roles, QUICK_ACTION_PERMISSIONS);

  /** Reloads the target's moderation state (ban/mute) after an admin action. */
  async function refreshAdminState(id: string) {
    try {
      const res = await fetch(`/api/admin/players/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAdminState({
        bannedAt: data.player?.bannedAt ?? null,
        banReason: data.player?.banReason ?? null,
        mutedUntil: data.player?.mutedUntil ?? null,
      });
    } catch {
      /* non-fatal: the tab just won't show ban/mute status */
    }
  }

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError("");
    setProfile(null);
    setAchievements(null);
    setAdminState(null);
    setTab("stats");

    if (showAdminTab) refreshAdminState(playerId);

    Promise.all([
      fetch(`/api/players/${playerId}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (!res.ok) throw new Error("Player not found");
        return res.json();
      }),
      fetch(`/api/players/${playerId}/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => (res.ok ? res.json() : { achievements: [] })),
    ])
      .then(([profileData, achievementData]: [any, any]) => {
        setProfile({ ...profileData, nameEffect: profileData.equippedNameEffect ?? null });
        setAchievements(achievementData.achievements ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [playerId, token]);

  const winRate =
    profile && profile.stats.handsPlayed > 0
      ? Math.round((profile.stats.handsWon / profile.stats.handsPlayed) * 100)
      : 0;

  return (
    <Modal isOpen={!!playerId} onClose={onClose}>
      {loading && (
        <div className="flex justify-center py-8">
          <p className="text-[12px] text-[var(--parchment-dim)]">Loading profile…</p>
        </div>
      )}

      {error && (
        <p className="text-red-300 text-[12px] text-center py-4">{error}</p>
      )}

      {profile && (
        <div className="flex flex-col gap-4">
          {/* Avatar + identity */}
          <div className="flex items-center gap-3.5">
            <div
              className="shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-[var(--brass)]/45"
              style={{ backgroundColor: profile.avatarColor, width: 52, height: 52 }}
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <DisplayName
                displayName={profile.displayName}
                nameEffect={profile.nameEffect}
                roles={profile.roles}
                className="font-display text-lg text-[var(--parchment)] leading-tight"
              />
              <p className="text-[11.5px] text-[#7d6f4d]">@{profile.username}</p>
              {profile.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {profile.roles.map((role) => (
                    <RoleBadge key={role.id} role={role} />
                  ))}
                </div>
              )}
              <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-[#e8cd7a]">
                {formatChips(profile.chips)}
                <span className="ml-1.5 text-[10px] font-normal uppercase tracking-[0.14em] text-[var(--parchment-dim)]">
                  chips
                </span>
              </p>
            </div>
          </div>

          <hr className="brass-rule" />

          {/* Tab switcher */}
          <div className="flex gap-1">
            <button
              onClick={() => setTab("stats")}
              data-active={tab === "stats"}
              className="casino-seg flex-1 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em]"
            >
              Stats
            </button>
            <button
              onClick={() => setTab("achievements")}
              data-active={tab === "achievements"}
              className="casino-seg flex-1 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em]"
            >
              Awards
              {achievements && achievements.filter((a) => a.unlockedAt !== null).length > 0 && (
                <span className="ml-1.5 rounded bg-[var(--brass)]/20 px-1.5 py-px text-[10px] tabular-nums text-[#e8cd7a]">
                  {achievements.filter((a) => a.unlockedAt !== null).length}
                </span>
              )}
            </button>
            {showAdminTab && (
              <button
                onClick={() => setTab("admin")}
                data-active={tab === "admin"}
                className="casino-seg flex-1 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em]"
              >
                <i className="fa-solid fa-shield-halved mr-1.5 text-[10px]" />
                Admin
              </button>
            )}
          </div>

          {tab === "admin" && showAdminTab && playerId && (
            <AdminActions
              targetId={playerId}
              targetName={profile.displayName}
              token={token}
              roles={user?.roles}
              adminState={adminState}
              onChanged={() => refreshAdminState(playerId)}
            />
          )}

          {/* Stats tab */}
          {tab === "stats" && (
            profile.stats.handsPlayed === 0 ? (
              <p className="text-center text-[12px] text-[#7d6f4d] py-4">
                No hands played yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <StatCard
                  label="Hands Played"
                  value={profile.stats.handsPlayed.toLocaleString()}
                />
                <StatCard
                  label="Win Rate"
                  value={`${winRate}%`}
                  positive={winRate >= 50}
                />
                <StatCard
                  label="Blackjacks"
                  value={profile.stats.blackjacks.toLocaleString()}
                  positive={profile.stats.blackjacks > 0}
                />
                <StatCard
                  label="Net Winnings"
                  value={
                    (profile.stats.netWinnings >= 0 ? "+" : "") +
                    formatChips(profile.stats.netWinnings)
                  }
                  positive={profile.stats.netWinnings > 0}
                  negative={profile.stats.netWinnings < 0}
                />
                <StatCard
                  label="Biggest Win"
                  value={`+${formatChips(profile.stats.biggestWin)}`}
                />
                <StatCard
                  label="Biggest Bet"
                  value={formatChips(profile.stats.biggestBet)}
                />
                <StatCard
                  label="Doubles"
                  value={profile.stats.doublesMade.toLocaleString()}
                />
                <StatCard
                  label="Splits"
                  value={profile.stats.splitsMade.toLocaleString()}
                />
                <StatCard
                  label="Pushes"
                  value={profile.stats.handsPushed.toLocaleString()}
                />
                <StatCard
                  label="Busts"
                  value={profile.stats.timesBusted.toLocaleString()}
                  negative={profile.stats.timesBusted > 0}
                />
              </div>
            )
          )}

          {/* Achievements tab */}
          {tab === "achievements" && (
            <AchievementsPanel achievements={achievements ?? []} />
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Tailwind class map keyed by the `color` value stored in the `roles` table.
 * All strings are written out in full so Tailwind's scanner picks them up.
 * Add a new entry here when a new color is introduced via admin tooling.
 */
const ROLE_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  sky:     { bg: "bg-sky-500/20",     text: "text-sky-400",     border: "border-sky-500/30"     },
  amber:   { bg: "bg-amber-500/20",   text: "text-amber-400",   border: "border-amber-500/30"   },
  violet:  { bg: "bg-violet-500/20",  text: "text-violet-400",  border: "border-violet-500/30"  },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  rose:    { bg: "bg-rose-500/20",    text: "text-rose-400",    border: "border-rose-500/30"    },
  blue:    { bg: "bg-blue-500/20",    text: "text-blue-400",    border: "border-blue-500/30"    },
  purple:  { bg: "bg-purple-500/20",  text: "text-purple-400",  border: "border-purple-500/30"  },
  red:     { bg: "bg-red-500/20",     text: "text-red-400",     border: "border-red-500/30"     },
  // fallback for unknown colors defined via admin tooling:
  default: { bg: "bg-gray-500/20",    text: "text-gray-400",    border: "border-gray-500/30"    },
};

function RoleBadge({ role }: { role: RoleInfo }) {
  const colors = ROLE_COLOR_CLASSES[role.color] ?? ROLE_COLOR_CLASSES.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      <i className={`fa-solid ${role.icon} text-xs`} />
      {role.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  positive = false,
  negative = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="casino-panel px-3 py-2 flex flex-col gap-0.5">
      <p className="casino-eyebrow">{label}</p>
      <p
        className={`font-semibold text-[15px] tabular-nums ${
          negative
            ? "text-red-300"
            : positive
            ? "text-emerald-300"
            : "text-[#f0e4c6]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const CATEGORY_ORDER: AchievementCategory[] = [
  "skill", "streak", "gambler", "rare", "comeback", "meta", "funny",
];

const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string }> = {
  skill:    { label: "Skill",    icon: "fa-graduation-cap" },
  streak:   { label: "Streak",   icon: "fa-fire" },
  gambler:  { label: "Gambler",  icon: "fa-dice" },
  rare:     { label: "Rare",     icon: "fa-diamond" },
  comeback: { label: "Comeback", icon: "fa-heart-pulse" },
  meta:     { label: "Meta",     icon: "fa-chart-line" },
  funny:    { label: "Funny",    icon: "fa-face-laugh" },
};

function AchievementsPanel({ achievements }: { achievements: AchievementInfo[] }) {
  if (achievements.length === 0) {
    return (
      <p className="text-center text-[12px] text-[#7d6f4d] py-4">Loading achievements…</p>
    );
  }

  const byCategory = new Map<AchievementCategory, AchievementInfo[]>();
  for (const a of achievements) {
    const cat = (a.category ?? "meta") as AchievementCategory;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(a);
  }

  const totalUnlocked = achievements.filter((a) => a.unlockedAt !== null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Overall progress reads better as a bar than as a bare fraction. */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="casino-eyebrow">Unlocked</span>
          <span className="text-[11px] tabular-nums text-[var(--parchment-dim)]">
            {totalUnlocked} / {achievements.length}
          </span>
        </div>
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-black/50">
          <div
            className="h-full rounded-full bg-[var(--brass)]/75"
            style={{ width: `${(totalUnlocked / achievements.length) * 100}%` }}
          />
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const group = byCategory.get(cat);
        if (!group || group.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const unlockedInGroup = group.filter((a) => a.unlockedAt !== null).length;

        return (
          <div key={cat} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${meta.icon} text-[10px] text-[var(--parchment-dim)]`} />
              <p className="casino-eyebrow">{meta.label}</p>
              <span className="ml-auto text-[10.5px] tabular-nums text-[#7d6f4d]">
                {unlockedInGroup}/{group.length}
              </span>
            </div>
            {group
              .sort((a, b) => {
                // Unlocked first, then locked; within each group sort by unlock date
                if (a.unlockedAt && !b.unlockedAt) return -1;
                if (!a.unlockedAt && b.unlockedAt) return 1;
                return (a.unlockedAt ?? 0) - (b.unlockedAt ?? 0);
              })
              .map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
          </div>
        );
      })}
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementInfo }) {
  const unlocked = achievement.unlockedAt !== null;
  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
        unlocked
          ? "border-[var(--brass)]/30 bg-[var(--brass)]/[0.07]"
          : "border-white/[0.06] bg-black/20 opacity-45"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          unlocked ? "bg-[var(--brass)]/18" : "bg-white/[0.04]"
        }`}
      >
        <i
          className={`fa-solid ${achievement.icon} text-[13px] ${
            unlocked ? "text-[#e8cd7a]" : "text-[#5d5540]"
          }`}
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <p
          className={`text-[13px] font-semibold leading-tight ${
            unlocked ? "text-[#f0e4c6]" : "text-[#8a7f5f]"
          }`}
        >
          {achievement.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#7d6f4d]">
          {achievement.description}
        </p>
        {unlocked && achievement.unlockedAt && (
          <p className="mt-0.5 text-[10.5px] text-[var(--parchment-dim)]">
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      {unlocked && (
        <i className="fa-solid fa-check ml-auto shrink-0 text-[11px] text-[var(--brass)]" />
      )}
    </div>
  );
}

// ─── In-game admin quick actions ─────────────────────────────────────────────

const ADMIN_BTN =
  "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed";
const ADMIN_BTN_NEUTRAL = `${ADMIN_BTN} btn-brass-ghost`;
const ADMIN_INPUT = "casino-input px-3 py-1.5 text-[12.5px]";

/**
 * Moderation actions against the player whose profile is open, shown at the
 * table so staff don't have to switch to the console for routine calls. Each
 * control is gated on the viewer's permissions, and the server re-checks every
 * request, so hiding a button is convenience and not the security boundary.
 */
function AdminActions({
  targetId,
  targetName,
  token,
  roles,
  adminState,
  onChanged,
}: {
  targetId: string;
  targetName: string;
  token: string | null;
  roles: RoleInfo[] | undefined;
  adminState: AdminState | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [chips, setChips] = useState("");
  const [reason, setReason] = useState("");

  const can = (p: Permission) => hasPermission(roles, p);
  const banned = Boolean(adminState?.bannedAt);
  const muted = Boolean(
    adminState?.mutedUntil && new Date(adminState.mutedUntil).getTime() > Date.now()
  );

  async function run(path: string, init: RequestInit, okMsg: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error ?? `Failed (${res.status})`);
      setMsg(okMsg);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="casino-eyebrow">Acting on</span>
        <span className="font-semibold text-[#e6d9b6]">{targetName}</span>
        {banned && (
          <span className="rounded border border-red-400/30 bg-red-500/15 px-1.5 py-0.5 text-red-200">
            banned
          </span>
        )}
        {muted && (
          <span className="rounded border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
            muted
          </span>
        )}
      </div>

      {err && (
        <p className="rounded-md border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[11.5px] text-red-200">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] text-emerald-200">
          {msg}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {can("player.kick") && (
          <button
            disabled={busy}
            className={ADMIN_BTN_NEUTRAL}
            onClick={() =>
              run(
                `/api/admin/players/${targetId}/kick`,
                { method: "POST", body: JSON.stringify({ reason: reason || null }) },
                "Kicked"
              )
            }
          >
            Kick from table
          </button>
        )}

        {can("player.mute") &&
          (muted ? (
            <button
              disabled={busy}
              className={ADMIN_BTN_NEUTRAL}
              onClick={() =>
                run(
                  `/api/admin/players/${targetId}/mute`,
                  { method: "POST", body: JSON.stringify({ minutes: null }) },
                  "Unmuted"
                )
              }
            >
              Unmute
            </button>
          ) : (
            <>
              {[10, 60].map((m) => (
                <button
                  key={m}
                  disabled={busy}
                  className={ADMIN_BTN_NEUTRAL}
                  onClick={() =>
                    run(
                      `/api/admin/players/${targetId}/mute`,
                      { method: "POST", body: JSON.stringify({ minutes: m }) },
                      `Muted ${m}m`
                    )
                  }
                >
                  Mute {m}m
                </button>
              ))}
            </>
          ))}

        {banned
          ? can("player.unban") && (
              <button
                disabled={busy}
                className={`${ADMIN_BTN} btn-go`}
                onClick={() =>
                  run(`/api/admin/players/${targetId}/unban`, { method: "POST" }, "Unbanned")
                }
              >
                Unban
              </button>
            )
          : can("player.ban") && (
              <button
                disabled={busy}
                className={`${ADMIN_BTN} btn-danger`}
                onClick={() =>
                  run(
                    `/api/admin/players/${targetId}/ban`,
                    { method: "POST", body: JSON.stringify({ reason: reason || null }) },
                    "Banned"
                  )
                }
              >
                Ban account
              </button>
            )}
      </div>

      {/* Shared by kick and ban — both show it to the player. */}
      {(can("player.kick") || (can("player.ban") && !banned)) && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional, shown to the player)"
          className={ADMIN_INPUT}
        />
      )}

      {can("player.adjust_chips") && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={chips}
            onChange={(e) => setChips(e.target.value)}
            placeholder="Chips ±"
            inputMode="numeric"
            className={`${ADMIN_INPUT} w-28`}
          />
          <button
            disabled={busy || !chips || Number.isNaN(Number(chips))}
            className={ADMIN_BTN_NEUTRAL}
            onClick={() =>
              run(
                `/api/admin/players/${targetId}/chips`,
                { method: "POST", body: JSON.stringify({ delta: Number(chips) }) },
                "Chips adjusted"
              )
            }
          >
            Adjust
          </button>
          <button
            disabled={busy || !chips || Number.isNaN(Number(chips))}
            className={ADMIN_BTN_NEUTRAL}
            onClick={() =>
              run(
                `/api/admin/players/${targetId}/chips`,
                { method: "POST", body: JSON.stringify({ set: Number(chips) }) },
                "Chips set"
              )
            }
          >
            Set
          </button>
          <span className="text-[11px] text-[#7d6f4d]">
            Applies immediately, at the table too if they're seated.
          </span>
        </div>
      )}

      <a
        href="/admin"
        className="text-[11px] text-[var(--parchment-dim)] underline-offset-2 transition-colors hover:text-[#e8cd7a] hover:underline"
      >
        Open full admin console →
      </a>
    </div>
  );
}
