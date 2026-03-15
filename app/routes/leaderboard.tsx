import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router";
import type { Route } from "./+types/home";
import { useAuth } from "~/lib/AuthContext";
import { DisplayName } from "~/components/ui/DisplayName";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Leaderboard · Blackjack" }];
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
  format: (v: number) => string;
}[] = [
  { key: "chips", label: "Total Chips", format: (v) => v.toLocaleString() },
  {
    key: "netWinnings",
    label: "Net Winnings",
    format: (v) => (v >= 0 ? "+" : "") + v.toLocaleString(),
  },
  { key: "handsPlayed", label: "Hands Played", format: (v) => v.toLocaleString() },
];

function TrophyIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span aria-label="Gold trophy">🏆</span>;
  if (rank === 2) return <span aria-label="Silver medal">🥈</span>;
  if (rank === 3) return <span aria-label="Bronze medal">🥉</span>;
  return null;
}

function rankStyles(rank: number): {
  text: string;
  rank: string;
  value: string;
  row: string;
} {
  if (rank === 1)
    return {
      text: "text-2xl font-black",
      rank: "text-2xl font-black text-yellow-400",
      value: "text-2xl font-black",
      row: "py-5",
    };
  if (rank === 2)
    return {
      text: "text-xl font-bold",
      rank: "text-xl font-bold text-gray-300",
      value: "text-xl font-bold",
      row: "py-4",
    };
  if (rank === 3)
    return {
      text: "text-lg font-semibold",
      rank: "text-lg font-semibold text-amber-500",
      value: "text-lg font-semibold",
      row: "py-4",
    };
  return {
    text: "text-base font-medium",
    rank: "text-base font-medium text-gray-500",
    value: "text-base font-medium",
    row: "py-3",
  };
}

export default function Leaderboard() {
  const { user, token } = useAuth();
  const [stat, setStat] = useState<LeaderboardStat>("chips");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  if (!user) return <Navigate to="/login" replace />;

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

  const currentStat = STATS.find((s) => s.key === stat)!;

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3 select-none">🏆</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Leaderboard</h1>
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors mt-2 inline-block"
          >
            ← Back to home
          </Link>
        </div>

        {/* Stat selector */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
          {STATS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStat(s.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                stat === s.key
                  ? "bg-emerald-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Leaderboard list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading && (
            <div className="text-center py-16 text-gray-500 text-sm">Loading...</div>
          )}
          {error && (
            <div className="text-center py-16 text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">No data yet</div>
          )}
          {!loading &&
            !error &&
            entries.map((entry, i) => {
              const rank = i + 1;
              const styles = rankStyles(rank);
              const isTop3 = rank <= 3;

              const valueColor =
                stat === "netWinnings"
                  ? entry.value >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-gray-200";

              return (
                <div
                  key={entry.playerId}
                  className={`grid grid-cols-[2rem_2rem_1fr_8rem] items-center px-6 gap-4 ${styles.row} ${
                    i < entries.length - 1 ? "border-b border-gray-800/60" : ""
                  } ${isTop3 ? "bg-gray-800/20" : ""}`}
                >
                  {/* Rank — fixed width */}
                  <span className={`${styles.rank} text-left`}>
                    {rank}
                  </span>

                  {/* Trophy — fixed width, empty for rank 4+ */}
                  <span className={`text-center ${rank === 1 ? "text-2xl" : rank === 2 ? "text-xl" : "text-lg"}`}>
                    {isTop3 && <TrophyIcon rank={rank} />}
                  </span>

                  {/* Player name — always the same column, always centered */}
                  <DisplayName
                    displayName={entry.displayName}
                    nameEffect={entry.nameEffect}
                    className={`${styles.text} truncate text-center`}
                  />

                  {/* Value — fixed width */}
                  <span className={`${styles.value} ${valueColor} text-right tabular-nums`}>
                    {currentStat.format(entry.value)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
