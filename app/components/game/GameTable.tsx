import type { GameState } from "~/lib/types";
import { DealerZone } from "./DealerZone";
import { PlayerSeat } from "./PlayerSeat";
import { BettingControls } from "./BettingControls";
import { ActionControls } from "./ActionControls";
import { ShoeIndicator } from "./ShoeIndicator";
import { Countdown } from "~/components/ui/Countdown";

interface GameTableProps {
  state: GameState;
  selfPlayerId: string;
  onBet: (amount: number) => void;
  onHit: (handId: string) => void;
  onStand: (handId: string) => void;
  onDouble: (handId: string) => void;
  onSplit: (handId: string) => void;
  onPlayerClick?: (playerId: string) => void;
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
}: GameTableProps) {
  const self = state.players.find((p) => p.playerId === selfPlayerId);
  const isSelfTurn = state.activePlayerId === selfPlayerId;
  const activeHand = isSelfTurn && self
    ? self.hands.find((h) => h.handId === state.activeHandId) ?? null
    : null;

  return (
    <div
      className="relative flex flex-col min-h-screen felt-bg"
    >
      {/* Top bar: shoe info + phase */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="text-sm text-gray-500">
          Room <span className="font-mono font-bold text-gray-300">{state.roomCode}</span>
          {" · "}Round <span className="text-gray-400">{state.roundNumber}</span>
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

        <ShoeIndicator shoe={state.shoe} hiLoCount={state.hiLoCount} />
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
