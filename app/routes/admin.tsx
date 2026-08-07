import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "~/lib/AuthContext";
import { ShellLayout } from "~/components/shell/ShellLayout";
import type { RoleInfo } from "~/lib/types";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  effectivePermissions,
  hasPermission,
  type Permission,
} from "~/lib/permissions";

// ─── Types mirroring the admin API ────────────────────────────────────────────

interface AdminPlayer {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  chips: number;
  bannedAt: string | null;
  banReason: string | null;
  mutedUntil: string | null;
  createdAt: string;
}

interface AdminDetail {
  player: AdminPlayer;
  stats: Record<string, number> | null;
  roles: RoleInfo[];
  achievements: string[];
}

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useApi() {
  const { token } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error ?? `Request failed (${res.status})`);
      return data as T;
    },
    [token]
  );
}

const isMuted = (p: { mutedUntil: string | null }) =>
  Boolean(p.mutedUntil && new Date(p.mutedUntil).getTime() > Date.now());

/* This is a staff tool, so it stays dense and utilitarian — it just wears the
   same palette as the rest of the site instead of its own grey theme. */
const BTN =
  "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all disabled:cursor-not-allowed";
const BTN_NEUTRAL = `${BTN} btn-brass-ghost`;
const BTN_DANGER = `${BTN} btn-danger`;
const BTN_GO = `${BTN} btn-go`;
const INPUT = "casino-input px-3 py-1.5 text-[12.5px]";

// ─── Page ─────────────────────────────────────────────────────────────────────

export function meta() {
  return [{ title: "Admin Console — Blackjack" }];
}

export default function Admin() {
  const { user } = useAuth();
  const api = useApi();

  const myPerms = useMemo(() => new Set(effectivePermissions(user?.roles ?? [])), [user]);
  const can = (p: Permission) => myPerms.has(p);

  const [tab, setTab] = useState<"players" | "roles">("players");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  if (!user) {
    return (
      <Shell>
        <p className="text-[13px] text-[var(--parchment-dim)]">You must be signed in.</p>
      </Shell>
    );
  }
  if (!hasPermission(user.roles, "admin.access")) {
    return (
      <Shell>
        <div className="rounded-md border border-red-400/25 bg-red-500/10 p-5">
          <h2 className="font-display text-lg text-red-200">Access denied</h2>
          <p className="mt-1 text-[12.5px] text-[#c7b78c]">
            Your roles don't grant the{" "}
            <code className="rounded bg-black/40 px-1 text-[#e6d9b6]">admin.access</code>{" "}
            permission. If you were recently granted a staff role, sign out and back in.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-1">
        {(["players", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-active={tab === t}
            className="casino-seg px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.09em]"
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12.5px] text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-[12.5px] text-emerald-200">
          {notice}
        </div>
      )}

      {tab === "players" ? (
        <PlayersTab api={api} can={can} flash={flash} fail={fail} />
      ) : (
        <RolesTab api={api} can={can} myPerms={myPerms} flash={flash} fail={fail} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ShellLayout contentClassName="px-4 py-8">
      {/* Wider than the other pages: the permission matrix needs the room. */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex items-baseline gap-3">
          <h1 className="font-display text-2xl text-[var(--parchment)]">Admin Console</h1>
          <span className="casino-eyebrow">Staff</span>
        </div>
        {children}
      </div>
    </ShellLayout>
  );
}

// ─── Players ──────────────────────────────────────────────────────────────────

function PlayersTab({
  api,
  can,
  flash,
  fail,
}: {
  api: ReturnType<typeof useApi>;
  can: (p: Permission) => boolean;
  flash: (m: string) => void;
  fail: (e: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [allRoles, setAllRoles] = useState<RoleInfo[]>([]);
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);

  const search = useCallback(
    async (q: string) => {
      try {
        const data = await api<{ players: AdminPlayer[] }>(
          `/api/admin/players?q=${encodeURIComponent(q)}`
        );
        setPlayers(data.players);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await api<AdminDetail>(`/api/admin/players/${id}`));
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  useEffect(() => {
    search("");
    api<{ roles: RoleInfo[] }>("/api/admin/roles").then((d) => setAllRoles(d.roles)).catch(fail);
    api<{ achievements: AchievementDef[] }>("/api/admin/achievements")
      .then((d) => setAchievements(d.achievements))
      .catch(fail);
  }, [api, search, fail]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      flash(msg);
      if (selectedId) await loadDetail(selectedId);
      await search(query);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* List */}
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="mb-3 flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username or name"
            className={`${INPUT} flex-1`}
          />
          <button type="submit" className={BTN_NEUTRAL}>
            Search
          </button>
        </form>

        <div className="casino-panel no-scrollbar max-h-[70vh] overflow-y-auto">
          {players.length === 0 && (
            <p className="p-4 text-[12px] text-[var(--parchment-dim)]">No players found.</p>
          )}
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex w-full items-center gap-3 border-b border-[var(--brass)]/10 px-3 py-2.5 text-left transition-colors last:border-0 ${
                selectedId === p.id
                  ? "bg-[var(--brass)]/[0.12]"
                  : "hover:bg-white/[0.035]"
              }`}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: p.avatarColor }}
              >
                {p.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#e6d9b6]">
                  {p.displayName}
                </span>
                <span className="block truncate text-[11px] text-[#7d6f4d]">@{p.username}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[11.5px] tabular-nums text-[#e8cd7a]">
                  {p.chips.toLocaleString()}
                </span>
                <span className="flex gap-1">
                  {p.bannedAt && (
                    <span className="rounded border border-red-400/25 bg-red-500/15 px-1 text-[9.5px] text-red-200">
                      banned
                    </span>
                  )}
                  {isMuted(p) && (
                    <span className="rounded border border-amber-400/25 bg-amber-500/15 px-1 text-[9.5px] text-amber-200">
                      muted
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div>
        {!detail ? (
          <p className="text-[12.5px] text-[var(--parchment-dim)]">
            Select a player to manage them.
          </p>
        ) : (
          <PlayerDetail
            detail={detail}
            allRoles={allRoles}
            achievements={achievements}
            can={can}
            act={act}
            api={api}
          />
        )}
      </div>
    </div>
  );
}

function PlayerDetail({
  detail,
  allRoles,
  achievements,
  can,
  act,
  api,
}: {
  detail: AdminDetail;
  allRoles: RoleInfo[];
  achievements: AchievementDef[];
  can: (p: Permission) => boolean;
  act: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
  api: ReturnType<typeof useApi>;
}) {
  const p = detail.player;
  const [chipInput, setChipInput] = useState("");
  const [muteMinutes, setMuteMinutes] = useState("60");
  const [banReason, setBanReason] = useState("");
  const banned = Boolean(p.bannedAt);
  const muted = isMuted(p);

  const hasRole = (roleId: string) => detail.roles.some((r) => r.id === roleId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="casino-panel p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--brass)]/45 text-base font-bold text-white"
            style={{ background: p.avatarColor }}
          >
            {p.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg text-[var(--parchment)]">
              {p.displayName}
            </h2>
            <p className="text-[11px] text-[#7d6f4d]">@{p.username}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xl font-bold tabular-nums text-[#f0dca4]">
              {p.chips.toLocaleString()}
            </p>
            <p className="casino-eyebrow">chips</p>
          </div>
        </div>
        {(banned || muted) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
            {banned && (
              <span className="rounded border border-red-400/25 bg-red-500/12 px-2 py-1 text-red-200">
                Banned{p.banReason ? `: ${p.banReason}` : ""}
              </span>
            )}
            {muted && (
              <span className="rounded border border-amber-400/25 bg-amber-500/12 px-2 py-1 text-amber-200">
                Muted until {new Date(p.mutedUntil!).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Economy */}
      <Section title="Economy" show={can("player.adjust_chips") || can("player.reset_stats")}>
        {can("player.adjust_chips") && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={chipInput}
              onChange={(e) => setChipInput(e.target.value)}
              placeholder="Amount"
              inputMode="numeric"
              className={`${INPUT} w-32`}
            />
            <button
              className={BTN_NEUTRAL}
              disabled={!chipInput}
              onClick={() =>
                act(
                  () =>
                    api(`/api/admin/players/${p.id}/chips`, {
                      method: "POST",
                      body: JSON.stringify({ delta: Number(chipInput) }),
                    }),
                  "Chips adjusted"
                )
              }
            >
              Add / subtract
            </button>
            <button
              className={BTN_NEUTRAL}
              disabled={!chipInput}
              onClick={() =>
                act(
                  () =>
                    api(`/api/admin/players/${p.id}/chips`, {
                      method: "POST",
                      body: JSON.stringify({ set: Number(chipInput) }),
                    }),
                  "Chips set"
                )
              }
            >
              Set to
            </button>
          </div>
        )}
        {can("player.reset_stats") && (
          <button
            className={BTN_DANGER}
            onClick={() =>
              act(
                () =>
                  api(`/api/admin/players/${p.id}/reset-stats`, { method: "POST" }),
                "Stats reset"
              )
            }
          >
            Reset stats
          </button>
        )}
      </Section>

      {/* Moderation */}
      <Section
        title="Moderation"
        show={can("player.kick") || can("player.mute") || can("player.ban") || can("player.unban")}
      >
        {can("player.kick") && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason (optional, shown to the player)"
              className={`${INPUT} w-64`}
            />
            <button
              className={BTN_NEUTRAL}
              onClick={() =>
                act(
                  () =>
                    api(`/api/admin/players/${p.id}/kick`, {
                      method: "POST",
                      body: JSON.stringify({ reason: banReason || null }),
                    }),
                  "Kicked"
                )
              }
            >
              Kick from table
            </button>
          </div>
        )}

        {can("player.mute") &&
          (muted ? (
            <button
              className={BTN_NEUTRAL}
              onClick={() =>
                act(
                  () =>
                    api(`/api/admin/players/${p.id}/mute`, {
                      method: "POST",
                      body: JSON.stringify({ minutes: null }),
                    }),
                  "Unmuted"
                )
              }
            >
              Unmute
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={muteMinutes}
                onChange={(e) => setMuteMinutes(e.target.value)}
                inputMode="numeric"
                className={`${INPUT} w-20`}
              />
              <span className="text-[11px] text-[var(--parchment-dim)]">min</span>
              <button
                className={BTN_NEUTRAL}
                onClick={() =>
                  act(
                    () =>
                      api(`/api/admin/players/${p.id}/mute`, {
                        method: "POST",
                        body: JSON.stringify({ minutes: Number(muteMinutes) }),
                      }),
                    "Muted"
                  )
                }
              >
                Mute
              </button>
            </div>
          ))}

        {banned
          ? can("player.unban") && (
              <button
                className={BTN_GO}
                onClick={() =>
                  act(
                    () => api(`/api/admin/players/${p.id}/unban`, { method: "POST" }),
                    "Unbanned"
                  )
                }
              >
                Unban
              </button>
            )
          : can("player.ban") && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className={`${INPUT} w-56`}
                />
                <button
                  className={BTN_DANGER}
                  onClick={() =>
                    act(
                      () =>
                        api(`/api/admin/players/${p.id}/ban`, {
                          method: "POST",
                          body: JSON.stringify({ reason: banReason || null }),
                        }),
                      "Banned"
                    )
                  }
                >
                  Ban account
                </button>
              </div>
            )}
      </Section>

      {/* Roles */}
      <Section title="Roles" show={can("role.assign")}>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((r) => {
            const on = hasRole(r.id);
            return (
              <button
                key={r.id}
                onClick={() =>
                  act(
                    () =>
                      api(`/api/admin/players/${p.id}/roles/${r.id}`, {
                        method: on ? "DELETE" : "POST",
                      }),
                    on ? `Removed ${r.label}` : `Assigned ${r.label}`
                  )
                }
                className={`${BTN} ${
                  on
                    ? "btn-go"
                    : "btn-brass-ghost"
                }`}
                title={`${r.permissions?.length ?? 0} permissions`}
              >
                {on ? "✓ " : "+ "}
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#7d6f4d]">
          You can only assign roles whose permissions you already hold.
        </p>
      </Section>

      {/* Achievements */}
      <Section
        title="Achievements"
        show={can("player.grant_achievement") || can("player.revoke_achievement")}
      >
        <div className="no-scrollbar max-h-56 w-full space-y-1 overflow-y-auto pr-1">
          {achievements.map((a) => {
            const unlocked = detail.achievements.includes(a.id);
            const allowed = unlocked
              ? can("player.revoke_achievement")
              : can("player.grant_achievement");
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-[var(--brass)]/12 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[#e6d9b6]">{a.name}</span>
                  <span className="block truncate text-[11px] text-[#7d6f4d]">
                    {a.description}
                  </span>
                </span>
                <button
                  disabled={!allowed}
                  className={unlocked ? BTN_DANGER : BTN_NEUTRAL}
                  onClick={() =>
                    act(
                      () =>
                        api(`/api/admin/players/${p.id}/achievements/${a.id}`, {
                          method: unlocked ? "DELETE" : "POST",
                        }),
                      unlocked ? "Revoked" : "Granted"
                    )
                  }
                >
                  {unlocked ? "Revoke" : "Grant"}
                </button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="casino-panel p-4">
      <h3 className="casino-eyebrow mb-3">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// ─── Roles / permission matrix ────────────────────────────────────────────────

function RolesTab({
  api,
  can,
  myPerms,
  flash,
  fail,
}: {
  api: ReturnType<typeof useApi>;
  can: (p: Permission) => boolean;
  myPerms: Set<Permission>;
  flash: (m: string) => void;
  fail: (e: unknown) => void;
}) {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});

  const load = useCallback(async () => {
    try {
      const d = await api<{ roles: RoleInfo[] }>("/api/admin/roles");
      setRoles(d.roles);
      setDraft(
        Object.fromEntries(d.roles.map((r) => [r.id, new Set(r.permissions ?? [])]))
      );
    } catch (e) {
      fail(e);
    }
  }, [api, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = can("role.manage");

  const toggle = (roleId: string, perm: Permission) => {
    setDraft((d) => {
      const next = new Set(d[roleId] ?? []);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return { ...d, [roleId]: next };
    });
  };

  const save = async (role: RoleInfo) => {
    try {
      await api(`/api/admin/roles/${role.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: [...(draft[role.id] ?? [])] }),
      });
      flash(`${role.label} permissions saved`);
      await load();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[12.5px] leading-relaxed text-[#c7b78c]">
        Grant each role exactly the tools it should have. You can only toggle permissions you
        hold yourself, and you can't edit a role that already holds a permission you lack. The
        server enforces both.
      </p>

      {roles.map((role) => {
        const outranksMe = (role.permissions ?? []).some((p) => !myPerms.has(p as Permission));
        const dirty =
          [...(draft[role.id] ?? [])].sort().join(",") !==
          [...(role.permissions ?? [])].sort().join(",");

        return (
          <div key={role.id} className="casino-panel p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-display text-base text-[var(--parchment)]">{role.label}</h3>
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-[#8a7f5f]">
                {role.name}
              </code>
              <span className="text-[11px] tabular-nums text-[var(--parchment-dim)]">
                {(draft[role.id] ?? new Set()).size} / {Object.keys(PERMISSIONS).length}
              </span>
              {editable && !outranksMe && (
                <button
                  className={`${BTN_GO} ml-auto`}
                  disabled={!dirty}
                  onClick={() => save(role)}
                >
                  Save
                </button>
              )}
              {outranksMe && (
                <span className="ml-auto text-[11px] text-amber-300/80">
                  This role outranks you; read-only.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="casino-eyebrow mb-1.5">{group.label}</p>
                  <div className="space-y-1">
                    {group.permissions.map((perm) => {
                      const checked = (draft[role.id] ?? new Set()).has(perm);
                      const locked = !editable || outranksMe || !myPerms.has(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-start gap-2 text-[12.5px] ${
                            locked ? "opacity-40" : "cursor-pointer"
                          }`}
                          title={locked && !myPerms.has(perm) ? "You don't hold this permission" : ""}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => toggle(role.id, perm)}
                            className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-[var(--brass)]"
                          />
                          <span>
                            <span className="text-[#d5c398]">{PERMISSIONS[perm]}</span>
                            <code className="ml-1 text-[10.5px] text-[#6b6144]">{perm}</code>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
