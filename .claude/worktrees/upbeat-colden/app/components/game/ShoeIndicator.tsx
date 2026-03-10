import type { ShoeState } from "~/lib/types";
import { CUT_CARD_PENETRATION } from "~/lib/constants";

interface ShoeIndicatorProps {
  shoe: ShoeState;
  hiLoCount: number | null;
}

export function ShoeIndicator({ shoe, hiLoCount }: ShoeIndicatorProps) {
  const pct = Math.round(shoe.penetration * 100);
  const remaining = shoe.cardsRemaining;

  const barColor =
    shoe.penetration < 0.5
      ? "bg-emerald-500"
      : shoe.penetration < CUT_CARD_PENETRATION
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-400">Deck</span>
        <span>{remaining} cards left</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{pct}% dealt</span>
        {shoe.shufflePending && (
          <span className="text-amber-500 font-medium animate-pulse">
            Shuffle soon
          </span>
        )}
      </div>

      {/* Hi-Lo count hint */}
      {hiLoCount !== null && (
        <div className="mt-1 text-center">
          <span className="text-xs text-gray-500">Running count: </span>
          <span
            className={`text-sm font-bold ${
              hiLoCount > 2 ? "text-emerald-400" : hiLoCount < -2 ? "text-red-400" : "text-gray-400"
            }`}
          >
            {hiLoCount > 0 ? `+${hiLoCount}` : hiLoCount}
          </span>
        </div>
      )}
    </div>
  );
}
