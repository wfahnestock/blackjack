import { useState, useEffect } from "react";
import { CHIP_DENOMINATIONS } from "~/lib/constants";
import type { ChipDenomination } from "~/lib/constants";
import type { GameSettings } from "~/lib/types";
import { formatChips } from "~/lib/handUtils";
import { playButtonClick } from "~/lib/buttonSound";
import { chipStyle, chipCenterStyle } from "~/lib/chipStyle";

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
  // Stack of chip denominations added, so Undo can peel them back one at a time.
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    setPendingBet(currentBet);
    setHistory([]);
  }, [currentBet]);

  const commit = (amount: number, nextHistory: number[]) => {
    setPendingBet(amount);
    setHistory(nextHistory);
    onBet(amount);
  };

  const addChip = (denom: ChipDenomination) => {
    const next = pendingBet + denom;
    if (next <= settings.maxBet && next <= playerChips) {
      playButtonClick();
      commit(next, [...history, denom]);
    }
  };

  const undo = () => {
    if (history.length > 0) {
      playButtonClick();
      const last = history[history.length - 1];
      commit(Math.max(0, pendingBet - last), history.slice(0, -1));
    } else if (pendingBet > 0) {
      playButtonClick();
      commit(0, []);
    }
  };

  const clear = () => {
    playButtonClick();
    commit(0, []);
  };

  const allIn = () => {
    playButtonClick();
    commit(Math.min(settings.maxBet, playerChips), []);
  };

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center px-5 py-3 bg-gray-950/85 rounded-2xl border border-gray-800 shadow-xl">
      {/* Bet total */}
      <div className="flex flex-col items-start leading-none pr-4 border-r border-gray-700/50">
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Bet</span>
        <span className="text-2xl font-bold text-yellow-400 tabular-nums">
          {formatChips(pendingBet)}
        </span>
        <span className="text-[10px] text-gray-600 mt-0.5">
          max {formatChips(settings.maxBet)}
        </span>
      </div>

      {/* Chip rail */}
      <div className="flex gap-2">
        {CHIP_DENOMINATIONS.map((denom) => {
          const disabled =
            pendingBet + denom > playerChips || pendingBet + denom > settings.maxBet;
          return (
            <button
              key={denom}
              disabled={disabled}
              onClick={() => addChip(denom)}
              className="flex items-center justify-center font-bold text-white transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={chipStyle(denom, 44)}
            >
              <span style={{ ...chipCenterStyle(denom), fontSize: "9px" }}>{denom}</span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-4 border-l border-gray-700/50">
        <button
          onClick={undo}
          disabled={pendingBet === 0}
          title="Undo last chip"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-300 bg-gray-800/80 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-2" />
          </svg>
          Undo
        </button>
        <button
          onClick={clear}
          disabled={pendingBet === 0}
          className="px-3 py-2 rounded-xl text-sm text-gray-300 bg-gray-800/80 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
        <button
          onClick={allIn}
          disabled={playerChips === 0}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow"
        >
          All In
        </button>
      </div>
    </div>
  );
}
