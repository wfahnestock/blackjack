import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { CHIP_DENOMINATIONS, CHIP_COLORS } from "~/lib/constants";
import type { ChipDenomination } from "~/lib/constants";
import type { GameSettings } from "~/lib/types";
import { formatChips } from "~/lib/handUtils";
import { playButtonClick } from "~/lib/buttonSound";

interface BettingControlsProps {
  playerChips: number;
  currentBet: number;
  settings: GameSettings;
  onBet: (amount: number) => void;
}

export function BettingControls({
  playerChips,
  currentBet,
  settings,
  onBet,
}: BettingControlsProps) {
  const [pendingBet, setPendingBet] = useState(currentBet);

  useEffect(() => {
    setPendingBet(currentBet);
  }, [currentBet]);

  const addChip = (denom: ChipDenomination) => {
    const next = Math.min(settings.maxBet, pendingBet + denom);
    if (next <= playerChips) {
      playButtonClick();
      setPendingBet(next);
      onBet(next);
    }
  };

  const clear = () => {
    playButtonClick();
    setPendingBet(0);
    onBet(0);
  };

  const allIn = () => {
    playButtonClick();
    const amount = Math.min(settings.maxBet, playerChips);
    setPendingBet(amount);
    onBet(amount);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
      <div className="text-sm text-gray-400">
        Bet:{" "}
        <span className="text-yellow-400 font-bold text-lg">
          {formatChips(pendingBet)}
        </span>{" "}
        / {formatChips(settings.maxBet)} max
      </div>

      {/* Chip buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {CHIP_DENOMINATIONS.map((denom) => {
          const canAfford = pendingBet + denom <= playerChips;
          const wouldExceedMax = pendingBet + denom > settings.maxBet;
          return (
            <button
              key={denom}
              disabled={!canAfford || wouldExceedMax}
              onClick={() => addChip(denom)}
              className={`
                w-12 h-12 rounded-full font-bold text-xs text-white
                border-2 border-white/30 shadow-lg
                transition-transform active:scale-95
                disabled:opacity-30 disabled:cursor-not-allowed
                hover:scale-105 hover:shadow-xl
              `}
              style={{ backgroundColor: CHIP_COLORS[denom] }}
            >
              {denom}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="sm" onClick={clear} disabled={pendingBet === 0}>
          Clear
        </Button>
        <Button variant="ghost" size="sm" onClick={allIn}>
          All In
        </Button>
      </div>
    </div>
  );
}
