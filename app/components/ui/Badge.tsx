import type { PlayerStatus, HandResult } from "~/lib/types";

const STATUS_CONFIG: Record<PlayerStatus, { label: string; classes: string }> = {
  connected: { label: "Ready", classes: "bg-gray-800 text-gray-400 border-gray-700" },
  disconnected: { label: "Offline", classes: "bg-red-950 text-red-400 border-red-800" },
  betting: { label: "Betting", classes: "bg-amber-950 text-amber-400 border-amber-800" },
  acting: { label: "Your Turn", classes: "bg-emerald-950 text-emerald-400 border-emerald-700 animate-pulse" },
  waiting: { label: "Done", classes: "bg-gray-800 text-gray-500 border-gray-700" },
  "sitting-out": { label: "Sitting Out", classes: "bg-gray-900 text-gray-600 border-gray-800" },
};

const RESULT_CONFIG: Record<NonNullable<HandResult>, { label: string; classes: string }> = {
  win: { label: "WIN", classes: "bg-emerald-600 text-white border-emerald-500" },
  blackjack: { label: "BLACKJACK!", classes: "bg-yellow-500 text-black border-yellow-400 font-black" },
  "five-card-charlie": { label: "5-CARD CHARLIE!", classes: "bg-purple-500 text-white border-purple-400 font-black" },
  lose: { label: "LOSE", classes: "bg-red-800 text-white border-red-700" },
  bust: { label: "BUST", classes: "bg-red-950 text-red-400 border-red-800" },
  push: { label: "PUSH", classes: "bg-gray-700 text-gray-300 border-gray-600" },
};

interface StatusBadgeProps {
  status: PlayerStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${config.classes}`}>
      {config.label}
    </span>
  );
}

interface ResultBadgeProps {
  result: NonNullable<HandResult>;
}

export function ResultBadge({ result }: ResultBadgeProps) {
  const config = RESULT_CONFIG[result];
  return (
    <span className={`text-sm px-3 py-1 rounded-full border font-bold tracking-wide ${config.classes}`}>
      {config.label}
    </span>
  );
}
