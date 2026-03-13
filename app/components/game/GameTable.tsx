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
      <div className="grid grid-cols-3 items-center px-6 pt-4 pb-2">
        {/* Left */}
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

        {/* Center — always truly centered regardless of timer presence */}
        <div className="flex items-center justify-center gap-4">
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

        {/* Right */}
        <div className="flex items-center justify-end gap-3">
          {onChatToggle && (
            <button
              onClick={onChatToggle}
              title="Toggle chat"
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors text-sm"
            >
              <svg viewBox="0 0 37 32" className="w-5 h-5">
                <g>
                  <path fill="currentColor" d="M6.371,20.055l-1.924,4.103c-0.089,0.189-0.05,0.416,0.098,0.564c0.096,0.097,0.224,0.147,0.354,0.147c0.071,0,0.143-0.015,0.21-0.046l6.774-3.139c0.777,0.095,1.489,0.141,2.17,0.141c7.779,0,14.107-4.896,14.107-10.913C28.161,4.896,21.833,0,14.054,0S-0.053,4.896-0.053,10.912C-0.053,14.645,2.338,18.032,6.371,20.055z M14.054,1c7.227,0,13.107,4.446,13.107,9.912s-5.88,9.913-13.107,9.913c-0.681,0-1.396-0.049-2.187-0.15c-0.092-0.011-0.188,0.004-0.273,0.042l-5.658,2.621l1.551-3.307c0.057-0.12,0.062-0.258,0.017-0.383s-0.139-0.228-0.26-0.283c-3.943-1.823-6.297-4.983-6.297-8.453C0.947,5.446,6.827,1,14.054,1z"/>
                  <path fill="currentColor" d="M7.197,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.19-0.278,1.572-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.775-0.188-1.58,0.091-2.062,0.705c-0.382,0.485-0.517,1.115-0.369,1.727C5.917,12.587,6.486,13.156,7.197,13.328z M6.901,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.63,0.369,0.713,0.713c0.076,0.317,0.011,0.628-0.183,0.874c-0.244,0.31-0.645,0.445-1.042,0.351c-0.344-0.083-0.63-0.369-0.713-0.713C6.642,11.326,6.707,11.016,6.901,10.77z"/>
                  <path fill="currentColor" d="M13.098,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.189-0.278,1.571-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.774-0.188-1.579,0.091-2.062,0.705c-0.382,0.485-0.517,1.114-0.37,1.727C11.817,12.586,12.387,13.156,13.098,13.328z M12.802,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.631,0.369,0.713,0.713c0.077,0.317,0.012,0.628-0.183,0.874c-0.243,0.311-0.644,0.446-1.042,0.351c-0.344-0.083-0.631-0.369-0.714-0.713C12.542,11.326,12.607,11.016,12.802,10.77z"/>
                  <path fill="currentColor" d="M18.998,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.19-0.278,1.572-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.774-0.188-1.58,0.091-2.062,0.705c-0.382,0.485-0.517,1.114-0.369,1.727C17.719,12.587,18.288,13.156,18.998,13.328z M18.702,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.63,0.369,0.713,0.713c0.076,0.317,0.011,0.628-0.183,0.874c-0.244,0.31-0.646,0.445-1.042,0.351c-0.344-0.083-0.631-0.369-0.714-0.713C18.443,11.326,18.508,11.016,18.702,10.77z"/>
                  <path fill="currentColor" d="M29.908,12.218c-0.268-0.075-0.543,0.073-0.622,0.337c-0.079,0.265,0.071,0.543,0.336,0.622c3.847,1.146,6.431,4.009,6.431,7.121c0,2.683-1.917,5.206-5.003,6.585c-0.214,0.096-0.333,0.327-0.286,0.557l0.59,2.861l-3.17-2.395c-0.107-0.08-0.24-0.11-0.373-0.096c-0.652,0.094-1.296,0.142-1.916,0.142c-3.661,0-7.203-1.87-8.613-4.548c-0.128-0.245-0.432-0.338-0.675-0.21c-0.244,0.129-0.338,0.431-0.209,0.675c1.575,2.993,5.481,5.083,9.498,5.083c0.601,0,1.223-0.041,1.851-0.123l4.065,3.07C31.9,31.966,32.006,32,32.113,32c0.093,0,0.186-0.025,0.267-0.077c0.176-0.111,0.265-0.32,0.223-0.523l-0.779-3.774c3.236-1.577,5.229-4.354,5.229-7.327C37.053,16.684,34.249,13.513,29.908,12.218z"/>
                </g>
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
