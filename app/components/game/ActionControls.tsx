import { Button } from "~/components/ui/Button";
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

  // Can split: 2 cards, equal values, < MAX_SPLITS existing splits, enough chips
  const splitCount = player.hands.filter((h) => h.splitFromHandId !== null).length;
  const canSplitHand =
    visibleCards.length === 2 &&
    splitCount < MAX_SPLITS &&
    player.chips >= hand.bet &&
    visibleCards[0].rank === visibleCards[1].rank;
    // Note: server also checks equal-value (10/J/Q/K), this is a quick client check

  return (
    <div className="flex gap-2 flex-wrap justify-center p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
      <Button
        variant="primary"
        size="lg"
        onClick={onHit}
        disabled={best >= 21}
      >
        Hit
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={onStand}
      >
        Stand
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={onDouble}
        disabled={!canDouble}
      >
        Double
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => { playButtonClick(); onSplit(); }}
        disabled={!canSplitHand}
      >
        Split
      </Button>
    </div>
  );
}
