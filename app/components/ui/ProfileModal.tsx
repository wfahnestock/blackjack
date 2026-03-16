import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { DisplayName } from "./DisplayName";
import { useAuth } from "~/lib/AuthContext";
import { formatChips } from "~/lib/handUtils";
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

type ProfileTab = "stats" | "achievements";

interface ProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

export function ProfileModal({ playerId, onClose }: ProfileModalProps) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [achievements, setAchievements] = useState<AchievementInfo[] | null>(null);
  const [tab, setTab] = useState<ProfileTab>("stats");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError("");
    setProfile(null);
    setAchievements(null);
    setTab("stats");

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
              <DisplayName
                displayName={profile.displayName}
                nameEffect={profile.nameEffect}
                roles={profile.roles}
                className="font-bold text-lg leading-tight"
              />
              <p className="text-sm text-gray-500">@{profile.username}</p>
              {profile.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.roles.map((role) => (
                    <RoleBadge key={role.id} role={role} />
                  ))}
                </div>
              )}
              <p className="text-sm text-yellow-500 font-medium mt-0.5">
                {formatChips(profile.chips)} chips
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1">
            <button
              onClick={() => setTab("stats")}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "stats"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Stats
            </button>
            <button
              onClick={() => setTab("achievements")}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "achievements"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Achievements
              {achievements && achievements.filter((a) => a.unlockedAt !== null).length > 0 && (
                <span className="ml-1.5 text-xs bg-indigo-500/80 text-white px-1.5 py-0.5 rounded-full">
                  {achievements.filter((a) => a.unlockedAt !== null).length}
                </span>
              )}
            </button>
          </div>

          {/* Stats tab */}
          {tab === "stats" && (
            profile.stats.handsPlayed === 0 ? (
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
      <p className="text-center text-gray-600 text-sm py-4">Loading achievements...</p>
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
      <p className="text-xs text-gray-500 text-center">
        {totalUnlocked} / {achievements.length} unlocked
      </p>

      {CATEGORY_ORDER.map((cat) => {
        const group = byCategory.get(cat);
        if (!group || group.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const unlockedInGroup = group.filter((a) => a.unlockedAt !== null).length;

        return (
          <div key={cat} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${meta.icon} text-xs text-gray-500`} />
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                {meta.label}
              </p>
              <span className="text-xs text-gray-600 ml-auto">
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
      className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
        unlocked
          ? "bg-indigo-500/10 border-indigo-500/30"
          : "bg-gray-800/40 border-gray-700/30 opacity-40"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          unlocked ? "bg-indigo-500/20" : "bg-gray-700/50"
        }`}
      >
        <i
          className={`fa-solid ${achievement.icon} text-sm ${
            unlocked ? "text-indigo-400" : "text-gray-600"
          }`}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <p
          className={`font-semibold text-sm leading-tight ${
            unlocked ? "text-white" : "text-gray-500"
          }`}
        >
          {achievement.name}
        </p>
        <p className="text-xs text-gray-500 leading-snug mt-0.5">
          {achievement.description}
        </p>
        {unlocked && achievement.unlockedAt && (
          <p className="text-xs text-indigo-400/70 mt-0.5">
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      {unlocked && (
        <i className="fa-solid fa-check text-emerald-400 text-xs ml-auto shrink-0" />
      )}
    </div>
  );
}
