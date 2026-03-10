import type { Hand } from "~/lib/types";
import { PlayingCard } from "./PlayingCard";
import { getScoreDisplay, getBestValue } from "~/lib/handUtils";

interface DealerZoneProps {
  hand: Hand;
}

export function DealerZone({ hand }: DealerZoneProps) {
  const score = getScoreDisplay(hand.cards);
  const best = getBestValue(hand.cards);
  const isBust = best > 21;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Dealer
      </span>

      {/* Cards */}
      <div className="flex -space-x-3">
        {hand.cards.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            style={{ zIndex: i, position: "relative" }}
          />
        ))}
        {hand.cards.length === 0 && (
          <div className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-700" />
        )}
      </div>

      {/* Score */}
      {score && (
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${
            isBust
              ? "bg-red-950 text-red-400"
              : best === 21
              ? "bg-yellow-900 text-yellow-400"
              : "bg-gray-800 text-gray-300"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}
