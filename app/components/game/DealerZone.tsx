import type { Hand } from "~/lib/types";
import { PlayingCard } from "./PlayingCard";
import { getScoreDisplay, getBestValue } from "~/lib/handUtils";

interface DealerZoneProps {
  hand: Hand;
  /** Card skin key for the dealer's deck.  Null = default styling.
   *  Reserved for future event-driven skins (e.g. "Gold Dealer" events). */
  cardSkin?: string | null;
}

export function DealerZone({ hand, cardSkin }: DealerZoneProps) {
  const score = getScoreDisplay(hand.cards);
  const best = getBestValue(hand.cards);
  const isBust = best > 21;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Header: DEALER label + value badge (reference layout) */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest">
          Dealer
        </span>
        {score && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              isBust
                ? "bg-red-950 text-red-400"
                : best === 21
                ? "bg-yellow-900 text-yellow-400"
                : "bg-gray-900 text-gray-100"
            }`}
          >
            {score}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex -space-x-3">
        {hand.cards.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            skin={cardSkin}
            dealAnimate
            style={{ zIndex: i, position: "relative" }}
          />
        ))}
        {hand.cards.length === 0 && (
          <div className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-700" />
        )}
      </div>
    </div>
  );
}
