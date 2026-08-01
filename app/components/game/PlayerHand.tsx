import type { Hand } from "~/lib/types";
import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./ChipStack";
import { ResultBadge } from "~/components/ui/Badge";
import { getScoreDisplay, getBestValue } from "~/lib/handUtils";
import { CHIP_DENOMINATIONS } from "~/lib/constants";
import { chipStyle, chipCenterStyle } from "~/lib/chipStyle";

interface PlayerHandProps {
  hand: Hand;
  isActive: boolean;
  small?: boolean;
  /** Card skin key from the owning player. */
  cardSkin?: string | null;
}

export function PlayerHand({ hand, isActive, small = false, cardSkin }: PlayerHandProps) {
  const score = getScoreDisplay(hand.cards);
  const best = getBestValue(hand.cards);
  const isBust = best > 21;
  const topDenom = [...CHIP_DENOMINATIONS].reverse().find((d) => d <= hand.bet) ?? CHIP_DENOMINATIONS[0];

  const scoreBadge = score ? (
    <span
      className={`text-sm font-bold px-2 py-0.5 rounded-full ${
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
  ) : null;

  return (
    <div
      className={`
        flex flex-col items-center ${small ? "gap-1" : "gap-2"} transition-all duration-300
        ${isActive && !small ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 rounded-xl p-2" : ""}
      `}
    >
      {/* Value badge above the cards (reference layout) in compact mode */}
      {small && scoreBadge}

      {/* Cards */}
      <div
        className={`flex -space-x-3 ${
          isActive && small ? "ring-2 ring-emerald-400/80 rounded-lg p-0.5" : ""
        }`}
      >
        {hand.cards.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            small={small}
            skin={cardSkin}
            dealAnimate
            className="transition-all duration-200"
            style={{ zIndex: i }}
          />
        ))}
        {hand.cards.length === 0 && (
          <div
            className={`
              ${small ? "w-[58px] h-[82px]" : "w-14 h-20"} rounded-lg
              border-2 border-dashed border-gray-700
            `}
          />
        )}
      </div>

      {/* Score below the cards in full (mobile) mode */}
      {!small && scoreBadge}

      {/* 5-Card Charlie indicator (shown while waiting for payout) */}
      {hand.fiveCardCharlie && !hand.result && (
        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-900 text-purple-300 border border-purple-700">
          5-Card Charlie!
        </span>
      )}

      {/* Bet — compact single chip on the felt spot when small, full stack otherwise */}
      {hand.bet > 0 && (small ? (
        <div className="flex items-center gap-1">
          <span className="flex items-center justify-center flex-shrink-0" style={chipStyle(topDenom, 40)}>
            <span
              className="font-bold leading-none tabular-nums"
              style={{ ...chipCenterStyle(topDenom), fontSize: hand.bet >= 1000 ? "8px" : "10px" }}
            >
              {hand.bet}
            </span>
          </span>
          {hand.doubled && <span className="text-[10px] text-blue-300 font-bold">2×</span>}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <ChipStack amount={hand.bet} size="sm" />
          {hand.doubled && (
            <span className="text-xs text-blue-400 font-medium">2×</span>
          )}
        </div>
      ))}

      {/* Result */}
      {hand.result && <ResultBadge result={hand.result} />}
    </div>
  );
}
