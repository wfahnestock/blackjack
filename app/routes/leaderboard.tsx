import { useState, useEffect } from "react";
import { Navigate } from "react-router";
import type { Route } from "./+types/home";
import { useAuth } from "~/lib/AuthContext";
import { DisplayName } from "~/components/ui/DisplayName";
import { ProfileModal } from "~/components/ui/ProfileModal";
import { ShellLayout } from "~/components/shell/ShellLayout";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Leaderboard — Blackjack" }];
}

type LeaderboardStat = "chips" | "netWinnings" | "handsPlayed";

type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  avatarColor: string;
  nameEffect: string | null;
  value: number;
};

const STATS: {
  key: LeaderboardStat;
  label: string;
  unit: string;
  format: (v: number) => string;
}[] = [
  { key: "chips", label: "Total Chips", unit: "chips", format: (v) => v.toLocaleString() },
  {
    key: "netWinnings",
    label: "Net Winnings",
    unit: "net",
    format: (v) => (v >= 0 ? "+" : "") + v.toLocaleString(),
  },
  { key: "handsPlayed", label: "Hands Played", unit: "hands", format: (v) => v.toLocaleString() },
];

/**
 * Medal colouring for the top three. Brass, silver and copper rather than
 * emoji: the emoji rendered at three different sizes and dragged the row
 * heights around with it.
 */
const MEDALS: Record<number, { ring: string; text: string }> = {
  1: { ring: "border-[#e8cd7a] bg-[#e8cd7a]/12", text: "text-[#f0dca4]" },
  2: { ring: "border-[#c9ccd4]/70 bg-[#c9ccd4]/10", text: "text-[#d6d9e0]" },
  3: { ring: "border-[#c17a49]/70 bg-[#c17a49]/10", text: "text-[#d99a69]" },
};

export default function Leaderboard() {
  const { user, token } = useAuth();
  const [stat, setStat] = useState<LeaderboardStat>("chips");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/leaderboard?stat=${stat}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: LeaderboardEntry[]) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load leaderboard");
        setLoading(false);
      });
  }, [stat, token]);

  // Guard *after* every hook — signing out flips `user` to null, and returning
  // above the hooks would change the hook count between renders.
  if (!user) return <Navigate to="/login" replace />;

  const currentStat = STATS.find((s) => s.key === stat)!;

  return (
    <>
      <ProfileModal
        playerId={profileId}
        onClose={() => setProfileId(null)}
        selfPlayerId={user.playerId}
      />

      <ShellLayout contentClassName="px-4 py-8">
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <h1 className="font-display text-2xl text-[var(--parchment)]">Leaderboard</h1>
            <span className="casino-eyebrow">Top {entries.length || "—"}</span>
          </div>

          {/* Stat picker */}
          <div className="flex gap-1 mb-5">
            {STATS.map((s) => (
              <button
                key={s.key}
                onClick={() => setStat(s.key)}
                data-active={stat === s.key}
                className="casino-seg flex-1 py-2 px-3 text-[12px] font-semibold uppercase tracking-[0.09em]"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="casino-panel overflow-hidden">
            {loading && (
              <p className="py-16 text-center text-[12px] text-[var(--parchment-dim)]">
                Loading…
              </p>
            )}
            {error && (
              <p className="py-16 text-center text-[12px] text-red-300">{error}</p>
            )}
            {!loading && !error && entries.length === 0 && (
              <p className="py-16 text-center text-[12px] text-[var(--parchment-dim)]">
                No hands played yet.
              </p>
            )}

            {!loading &&
              !error &&
              entries.map((entry, i) => {
                const rank = i + 1;
                const medal = MEDALS[rank];
                const isSelf = entry.playerId === user.playerId;

                const valueColor =
                  stat === "netWinnings"
                    ? entry.value >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                    : "text-[#f0e4c6]";

                return (
                  <button
                    key={entry.playerId}
                    onClick={() => setProfileId(entry.playerId)}
                    className={`group grid w-full grid-cols-[2.25rem_1.75rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i < entries.length - 1
                        ? "border-b border-[var(--brass)]/10"
                        : ""
                    } ${isSelf ? "bg-[var(--brass)]/[0.07]" : "hover:bg-white/[0.035]"}`}
                  >
                    {/* Rank chip — same box at every rank so rows stay level. */}
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-bold tabular-nums ${
                        medal
                          ? `${medal.ring} ${medal.text}`
                          : "border-transparent text-[#7d6f4d]"
                      }`}
                    >
                      {rank}
                    </span>

                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: entry.avatarColor }}
                    >
                      {entry.displayName.charAt(0).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex items-center gap-2">
                      <DisplayName
                        displayName={entry.displayName}
                        nameEffect={entry.nameEffect}
                        className="truncate text-[13.5px] text-[#e6d9b6]"
                      />
                      {isSelf && (
                        <span className="shrink-0 rounded border border-[var(--brass)]/30 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-[var(--parchment-dim)]">
                          You
                        </span>
                      )}
                    </span>

                    <span
                      className={`text-right text-[14px] font-semibold tabular-nums ${valueColor}`}
                    >
                      {currentStat.format(entry.value)}
                    </span>
                  </button>
                );
              })}
          </div>

          <p className="mt-3 text-[11px] text-[#7d6f4d]">
            Ranked by {currentStat.unit}. Select a player to view their profile.
          </p>
        </div>
      </ShellLayout>
    </>
  );
}
