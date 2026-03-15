import type { Hand } from "~/lib/types";
import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./ChipStack";
import { ResultBadge } from "~/components/ui/Badge";
import { getScoreDisplay, getBestValue } from "~/lib/handUtils";

interface PlayerHandProps {
  hand: Hand;
  isActive: boolean;
  small?: boolean;
}

export function PlayerHand({ hand, isActive, small = false }: PlayerHandProps) {
  const score = getScoreDisplay(hand.cards);
  const best = getBestValue(hand.cards);
  const isBust = best > 21;

  return (
    <div
      className={`
        flex flex-col items-center gap-2 transition-all duration-300
        ${isActive ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 rounded-xl p-2" : ""}
      `}
    >
      {/* Cards */}
      <div className="flex -space-x-3">
        {hand.cards.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            small={small}
            className="transition-all duration-200"
            style={{ zIndex: i }}
          />
        ))}
        {hand.cards.length === 0 && (
          <div
            className={`
              ${small ? "w-11 h-16" : "w-14 h-20"} rounded-lg
              border-2 border-dashed border-gray-700
            `}
          />
        )}
      </div>

      {/* Score */}
      {score && (
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isBust
              ? "bg-red-950 text-red-400"
              : hand.fiveCardCharlie
              ? "bg-purple-900 text-purple-300"
              : best === 21
              ? "bg-yellow-900 text-yellow-400"
              : "bg-gray-800 text-gray-300"
          }`}
        >
          {score}
        </span>
      )}

      {/* 5-Card Charlie indicator (shown while waiting for payout) */}
      {hand.fiveCardCharlie && !hand.result && (
        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-900 text-purple-300 border border-purple-700">
          5-Card Charlie!
        </span>
      )}

      {/* Bet */}
      {hand.bet > 0 && (
        <div className="flex flex-col items-center gap-1">
          <ChipStack amount={hand.bet} size="sm" />
          {hand.doubled && (
            <span className="text-xs text-blue-400 font-medium">2×</span>
          )}
        </div>
      )}

      {/* Result */}
      {hand.result && <ResultBadge result={hand.result} />}
    </div>
  );
}
