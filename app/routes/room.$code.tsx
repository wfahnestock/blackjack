import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { GameTable } from "~/components/game/GameTable";
import { useSocket } from "~/lib/useSocket";
import { useGameState } from "~/lib/useGameState";
import { usePlayer } from "~/lib/usePlayer";
import { useSoundEffects } from "~/lib/useSoundEffects";

export function meta() {
  return [{ title: "Blackjack — Game" }];
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const state = useGameState();
  const { playerId } = usePlayer();
  useSoundEffects(state);

  // Redirect back to lobby if game goes back to lobby phase
  useEffect(() => {
    if (state && state.phase === "lobby") {
      navigate(`/lobby/${code}`);
    }
  }, [state, code, navigate]);

  // If no state at all (hard refresh), go home
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!state) navigate("/");
    }, 3000);
    return () => clearTimeout(timeout);
  }, [state, navigate]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Connecting to game...</p>
      </div>
    );
  }

  return (
    <GameTable
      state={state}
      selfPlayerId={playerId}
      onBet={(amount) => socket.emit("game:place-bet", { amount })}
      onHit={(handId) => socket.emit("game:hit", { handId })}
      onStand={(handId) => socket.emit("game:stand", { handId })}
      onDouble={(handId) => socket.emit("game:double", { handId })}
      onSplit={(handId) => socket.emit("game:split", { handId })}
    />
  );
}
