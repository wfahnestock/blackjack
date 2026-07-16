import type { Hand, Player } from "~/lib/types";
import { getBestValue } from "~/lib/handUtils";
import { MAX_SPLITS } from "~/lib/constants";
import { playButtonClick } from "~/lib/buttonSound";

interface ActionControlsProps {
  hand: Hand;
  player: Player;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}

const PRIMARY =
  "px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow";
const SECONDARY =
  "px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-200 bg-gray-800/80 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

export function ActionControls({
  hand,
  player,
  onHit,
  onStand,
  onDouble,
  onSplit,
}: ActionControlsProps) {
  const best = getBestValue(hand.cards);
  const visibleCards = hand.cards.filter((c) => !c.faceDown);

  // Can double: 2 cards, enough chips
  const canDouble = visibleCards.length === 2 && player.chips >= hand.bet;

  // Can split: 2 cards, equal rank, under the split cap, enough chips
  const splitCount = player.hands.filter((h) => h.splitFromHandId !== null).length;
  const canSplitHand =
    visibleCards.length === 2 &&
    splitCount < MAX_SPLITS &&
    player.chips >= hand.bet &&
    visibleCards[0].rank === visibleCards[1].rank;

  const click = (fn: () => void) => () => {
    playButtonClick();
    fn();
  };

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center px-5 py-3 bg-gray-950/85 rounded-2xl border border-gray-800 shadow-xl">
      <button onClick={click(onHit)} disabled={best >= 21} className={PRIMARY}>
        Hit
      </button>
      <button onClick={click(onStand)} className={SECONDARY}>
        Stand
      </button>
      <button onClick={click(onDouble)} disabled={!canDouble} className={SECONDARY}>
        Double
      </button>
      <button onClick={click(onSplit)} disabled={!canSplitHand} className={SECONDARY}>
        Split
      </button>
    </div>
  );
}
