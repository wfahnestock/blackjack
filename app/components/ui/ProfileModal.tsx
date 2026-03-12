import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAuth } from "~/lib/AuthContext";
import { formatChips } from "~/lib/handUtils";

interface PlayerProfile {
  playerId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  chips: number;
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

interface ProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

export function ProfileModal({ playerId, onClose }: ProfileModalProps) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError("");
    setProfile(null);

    fetch(`/api/players/${playerId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Player not found");
        return res.json() as Promise<PlayerProfile>;
      })
      .then((data) => setProfile(data))
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
          <p className="text-gray-500 text-sm">Loading profile...</p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      )}

      {profile && (
        <div className="flex flex-col gap-5">
          {/* Avatar + identity */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-tight">
                {profile.displayName}
              </p>
              <p className="text-sm text-gray-500">@{profile.username}</p>
              <p className="text-sm text-yellow-500 font-medium mt-0.5">
                {formatChips(profile.chips)} chips
              </p>
            </div>
          </div>

          {/* Stats */}
          {profile.stats.handsPlayed === 0 ? (
            <p className="text-center text-gray-600 text-sm py-4">
              No hands played yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
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
          )}
        </div>
      )}
    </Modal>
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
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 flex flex-col gap-0.5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`font-bold text-base ${
          negative
            ? "text-red-400"
            : positive
            ? "text-emerald-400"
            : "text-gray-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
