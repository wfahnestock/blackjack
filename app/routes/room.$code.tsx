import { useEffect, useState } from "react";
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
  useSoundEffects(state, playerId);

  const [bankruptcyToast, setBankruptcyToast] = useState(false);

  // Show a toast when the server grants this player a bankruptcy relief stake
  useEffect(() => {
    const onBankruptcyRelief = ({ playerId: affected }: { playerId: string }) => {
      if (affected !== playerId) return;
      setBankruptcyToast(true);
      setTimeout(() => setBankruptcyToast(false), 3600);
    };
    socket.on("game:bankruptcy-relief", onBankruptcyRelief as any);
    return () => { socket.off("game:bankruptcy-relief", onBankruptcyRelief as any); };
  }, [socket, playerId]);

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
    <>
      <GameTable
        state={state}
        selfPlayerId={playerId}
        onBet={(amount) => socket.emit("game:place-bet", { amount })}
        onHit={(handId) => socket.emit("game:hit", { handId })}
        onStand={(handId) => socket.emit("game:stand", { handId })}
        onDouble={(handId) => socket.emit("game:double", { handId })}
        onSplit={(handId) => socket.emit("game:split", { handId })}
      />

      {/* Bankruptcy relief toast — only shown to the affected player */}
      {bankruptcyToast && (
        <div className="bankruptcy-toast fixed bottom-8 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900 border border-yellow-500/60 shadow-2xl">
          <span className="text-2xl">🪙</span>
          <div className="flex flex-col leading-tight">
            <span className="text-yellow-400 font-bold text-sm">Bankruptcy Relief</span>
            <span className="text-gray-300 text-xs">+100 chips — back in the game!</span>
          </div>
        </div>
      )}
    </>
  );
}
