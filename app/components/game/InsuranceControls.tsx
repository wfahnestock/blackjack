import { Button } from "~/components/ui/Button";
import { playButtonClick } from "~/lib/buttonSound";

interface InsuranceControlsProps {
  /** Cost of the insurance side bet (half the main bet). */
  cost: number;
  onTake: () => void;
  onDecline: () => void;
}

/**
 * Shown during the "insurance" phase when the dealer's upcard is an Ace.
 * Insurance costs half the player's bet and pays 2:1 if the dealer has blackjack.
 */
export function InsuranceControls({ cost, onTake, onDecline }: InsuranceControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-gray-900/80 rounded-2xl border border-gray-800 max-w-xs">
      <p className="text-sm font-semibold text-cyan-300">Dealer shows an Ace</p>
      <p className="text-xs text-gray-400 text-center leading-snug">
        Insurance costs {cost} chips and pays 2:1 if the dealer has blackjack.
      </p>
      <div className="flex gap-2 mt-1">
        <Button
          variant="primary"
          size="lg"
          onClick={() => { playButtonClick(); onTake(); }}
        >
          Insure ({cost})
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => { playButtonClick(); onDecline(); }}
        >
          No Thanks
        </Button>
      </div>
    </div>
  );
}
