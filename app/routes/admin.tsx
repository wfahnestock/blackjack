import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "~/lib/AuthContext";
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

const BTN =
  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
const BTN_NEUTRAL = `${BTN} bg-gray-800 hover:bg-gray-700 text-gray-200`;
const BTN_DANGER = `${BTN} bg-red-700 hover:bg-red-600 text-white`;
const BTN_GO = `${BTN} bg-emerald-600 hover:bg-emerald-500 text-white`;
const INPUT =
  "px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-gray-500";

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    return <Shell><p className="text-gray-400">You must be signed in.</p></Shell>;
  }
  if (!hasPermission(user.roles, "admin.access")) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-6">
          <h2 className="text-lg font-semibold text-red-300">Access denied</h2>
          <p className="mt-1 text-sm text-gray-400">
            Your roles don't grant the <code className="text-gray-300">admin.access</code>{" "}
            permission. If you were recently granted a staff role, sign out and back in.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-2">
        {(["players", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300">
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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Console</h1>
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-200">
            ← Back to game
          </Link>
        </div>
        {children}
      </div>
    </div>
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

        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-gray-800">
          {players.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No players found.</p>
          )}
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex w-full items-center gap-3 border-b border-gray-800/70 px-3 py-2.5 text-left transition-colors last:border-0 ${
                selectedId === p.id ? "bg-gray-800" : "hover:bg-gray-900"
              }`}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: p.avatarColor }}
              >
                {p.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-100">
                  {p.displayName}
                </span>
                <span className="block truncate text-xs text-gray-500">@{p.username}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-xs tabular-nums text-yellow-400">
                  {p.chips.toLocaleString()}
                </span>
                <span className="flex gap-1">
                  {p.bannedAt && (
                    <span className="rounded bg-red-900/70 px-1 text-[10px] text-red-200">
                      banned
                    </span>
                  )}
                  {isMuted(p) && (
                    <span className="rounded bg-amber-900/70 px-1 text-[10px] text-amber-200">
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
          <p className="text-sm text-gray-500">Select a player to manage them.</p>
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
      <div className="rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: p.avatarColor }}
          >
            {p.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{p.displayName}</h2>
            <p className="text-xs text-gray-500">@{p.username}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xl font-bold tabular-nums text-yellow-400">
              {p.chips.toLocaleString()}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-gray-500">chips</p>
          </div>
        </div>
        {(banned || muted) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {banned && (
              <span className="rounded bg-red-900/60 px-2 py-1 text-red-200">
                Banned{p.banReason ? `: ${p.banReason}` : ""}
              </span>
            )}
            {muted && (
              <span className="rounded bg-amber-900/60 px-2 py-1 text-amber-200">
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
          <button
            className={BTN_NEUTRAL}
            onClick={() =>
              act(() => api(`/api/admin/players/${p.id}/kick`, { method: "POST" }), "Kicked")
            }
          >
            Kick from table
          </button>
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
              <span className="text-xs text-gray-500">min</span>
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
                    ? "bg-emerald-700 text-white hover:bg-emerald-600"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
                title={`${r.permissions?.length ?? 0} permissions`}
              >
                {on ? "✓ " : "+ "}
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          You can only assign roles whose permissions you already hold.
        </p>
      </Section>

      {/* Achievements */}
      <Section
        title="Achievements"
        show={can("player.grant_achievement") || can("player.revoke_achievement")}
      >
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {achievements.map((a) => {
            const unlocked = detail.achievements.includes(a.id);
            const allowed = unlocked
              ? can("player.revoke_achievement")
              : can("player.grant_achievement");
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-gray-800 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-200">{a.name}</span>
                  <span className="block truncate text-xs text-gray-500">{a.description}</span>
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
    <div className="rounded-xl border border-gray-800 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {title}
      </h3>
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
      <p className="text-sm text-gray-400">
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
          <div key={role.id} className="rounded-xl border border-gray-800 p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-base font-semibold">{role.label}</h3>
              <code className="rounded bg-gray-900 px-1.5 py-0.5 text-xs text-gray-500">
                {role.name}
              </code>
              <span className="text-xs text-gray-500">
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
                <span className="ml-auto text-xs text-amber-400">
                  This role outranks you; read-only.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.permissions.map((perm) => {
                      const checked = (draft[role.id] ?? new Set()).has(perm);
                      const locked = !editable || outranksMe || !myPerms.has(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-start gap-2 text-sm ${
                            locked ? "opacity-40" : "cursor-pointer"
                          }`}
                          title={locked && !myPerms.has(perm) ? "You don't hold this permission" : ""}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => toggle(role.id, perm)}
                            className="mt-0.5 accent-emerald-500"
                          />
                          <span>
                            <span className="text-gray-300">{PERMISSIONS[perm]}</span>
                            <code className="ml-1 text-[11px] text-gray-600">{perm}</code>
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
