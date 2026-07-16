import { playButtonClick } from "~/lib/buttonSound";

interface InsuranceControlsProps {
  /** Cost of the insurance side bet (half the main bet). */
  cost: number;
  onTake: () => void;
  onDecline: () => void;
}

// Match the pill buttons used by ActionControls / BettingControls.
const PRIMARY =
  "px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow";
const SECONDARY =
  "px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-200 bg-gray-800/80 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

/**
 * Shown during the "insurance" phase when the dealer's upcard is an Ace.
 * Insurance costs half the player's bet and pays 2:1 if the dealer has blackjack.
 */
export function InsuranceControls({ cost, onTake, onDecline }: InsuranceControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center px-5 py-3 bg-gray-950/85 rounded-2xl border border-gray-800 shadow-xl">
      <div className="flex flex-col leading-tight pr-4 border-r border-gray-700/50">
        <span className="text-sm font-semibold text-cyan-300">Dealer shows an Ace</span>
        <span className="text-[11px] text-gray-400">Insurance costs {cost} · pays 2:1</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => { playButtonClick(); onTake(); }} className={PRIMARY}>
          Insure ({cost})
        </button>
        <button onClick={() => { playButtonClick(); onDecline(); }} className={SECONDARY}>
          No Thanks
        </button>
      </div>
    </div>
  );
}
