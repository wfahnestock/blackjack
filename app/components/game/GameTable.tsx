import { useState } from "react";
import type { GameState } from "~/lib/types";
import { DealerZone } from "./DealerZone";
import { PlayerSeat } from "./PlayerSeat";
import { BettingControls } from "./BettingControls";
import { ActionControls } from "./ActionControls";
import { ShoeIndicator } from "./ShoeIndicator";
import { Countdown } from "~/components/ui/Countdown";

const ACTIVE_PHASES: GameState["phase"][] = [
  "betting",
  "dealing",
  "player-turn",
  "dealer-turn",
  "payout",
];

interface GameTableProps {
  state: GameState;
  selfPlayerId: string;
  onBet: (amount: number) => void;
  onHit: (handId: string) => void;
  onStand: (handId: string) => void;
  onDouble: (handId: string) => void;
  onSplit: (handId: string) => void;
  onPlayerClick?: (playerId: string) => void;
  onLeave?: () => void;
  /** Number of unread chat messages; shows badge on the toggle button. */
  chatUnreadCount?: number;
  /** Called when the user clicks the chat toggle button in the top bar. */
  onChatToggle?: () => void;
}

export function GameTable({
  state,
  selfPlayerId,
  onBet,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onPlayerClick,
  onLeave,
  chatUnreadCount = 0,
  onChatToggle,
}: GameTableProps) {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const self = state.players.find((p) => p.playerId === selfPlayerId);
  const isSelfTurn = state.activePlayerId === selfPlayerId;
  const activeHand = isSelfTurn && self
    ? self.hands.find((h) => h.handId === state.activeHandId) ?? null
    : null;
  const isActiveMidRound = ACTIVE_PHASES.includes(state.phase);

  function handleLeaveClick() {
    if (isActiveMidRound) {
      setShowLeaveConfirm(true);
    } else {
      onLeave?.();
    }
  }

  return (
    <div
      className="relative flex flex-col min-h-screen felt-bg"
    >
      {/* Leave-table confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl p-6 max-w-xs w-full mx-4 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg viewBox="0 0 20 20" className="w-5 h-5 text-red-400 fill-current">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Leave the table?</p>
              <p className="text-gray-400 text-sm leading-snug">
                A round is in progress. You'll be marked as disconnected and your hand will be forfeited.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => { setShowLeaveConfirm(false); onLeave?.(); }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar: shoe info + phase */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {onLeave && (
            <button
              onClick={handleLeaveClick}
              title="Leave table"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors text-sm"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
                <path d="M6.5 3.5 2 8l4.5 4.5M2 8h10M9 3.5h3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Leave
            </button>
          )}
          <div className="text-sm text-gray-500">
            Room <span className="font-mono font-bold text-gray-300">{state.roomCode}</span>
            {" · "}Round <span className="text-gray-400">{state.roundNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <PhaseLabel phase={state.phase} />
          {state.phaseEndsAt && (
            <Countdown
              endsAt={state.phaseEndsAt}
              totalSeconds={
                state.phase === "betting"
                  ? state.settings.bettingTimerSeconds
                  : state.settings.turnTimerSeconds
              }
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          {onChatToggle && (
            <button
              onClick={onChatToggle}
              title="Toggle chat"
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors text-sm"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 0 0-.989-.57c-1.606-.63-3.448-.952-5.38-1.024L9 3.024l-.561.014c-1.933.072-3.774.395-5.38 1.024a4.45 4.45 0 0 0-.989.57c.255-1.16 1.188-2.1 2.435-2.267ZM1.5 9.4c0-1.95 1.268-3.562 3.01-4.12C5.965 4.694 7.457 4.5 9 4.5s3.035.194 4.49.78c1.742.558 3.01 2.17 3.01 4.12v.6c0 1.95-1.268 3.562-3.01 4.12a13.5 13.5 0 0 1-2.196.494L9 15.5l-2.294-.486a13.5 13.5 0 0 1-2.196-.494C2.768 13.562 1.5 11.95 1.5 10v-.6Z" />
              </svg>
              {chatUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                </span>
              )}
            </button>
          )}
          <ShoeIndicator shoe={state.shoe} hiLoCount={state.hiLoCount} />
        </div>
      </div>

      {/* Dealer area */}
      <div className="flex justify-center py-8">
        <DealerZone hand={state.dealerHand} />
      </div>

      {/* Divider line */}
      <div className="mx-8 border-t border-white/5" />

      {/* Player seats */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="flex gap-4 flex-wrap justify-center">
          {state.players.map((player) => (
            <PlayerSeat
              key={player.playerId}
              player={player}
              activeHandId={state.activeHandId}
              isCurrentPlayer={state.activePlayerId === player.playerId}
              isSelf={player.playerId === selfPlayerId}
              onPlayerClick={onPlayerClick}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center pb-6 px-4">
        {state.phase === "betting" && self && (
          <BettingControls
            playerChips={self.chips}
            currentBet={self.hands[0]?.bet ?? 0}
            settings={state.settings}
            onBet={onBet}
          />
        )}
        {state.phase === "player-turn" && isSelfTurn && activeHand && self && (
          <ActionControls
            hand={activeHand}
            player={self}
            onHit={() => onHit(activeHand.handId)}
            onStand={() => onStand(activeHand.handId)}
            onDouble={() => onDouble(activeHand.handId)}
            onSplit={() => onSplit(activeHand.handId)}
          />
        )}
        {state.phase === "dealer-turn" && (
          <div className="text-sm text-gray-500 py-4">Dealer is playing...</div>
        )}
      </div>
    </div>
  );
}

function PhaseLabel({ phase }: { phase: GameState["phase"] }) {
  const labels: Record<GameState["phase"], { text: string; color: string }> = {
    lobby: { text: "Lobby", color: "text-gray-500" },
    betting: { text: "Place Bets", color: "text-amber-400" },
    dealing: { text: "Dealing...", color: "text-blue-400" },
    "player-turn": { text: "Player Turns", color: "text-emerald-400" },
    "dealer-turn": { text: "Dealer Turn", color: "text-purple-400" },
    payout: { text: "Payout", color: "text-yellow-400" },
    cleanup: { text: "Next Round...", color: "text-gray-500" },
  };
  const { text, color } = labels[phase];
  return (
    <span className={`text-sm font-semibold uppercase tracking-wider ${color}`}>
      {text}
    </span>
  );
}
