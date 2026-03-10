import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/Button";
import { RoomCodeDisplay } from "~/components/lobby/RoomCodeDisplay";
import { PlayerList } from "~/components/lobby/PlayerList";
import { GameSettingsPanel } from "~/components/lobby/GameSettings";
import { useSocket } from "~/lib/useSocket";
import { useGameState } from "~/lib/useGameState";
import { usePlayer } from "~/lib/usePlayer";
import type { GameSettings } from "~/lib/types";

export function meta() {
  return [{ title: "Lobby — Blackjack" }];
}

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const state = useGameState();
  const { playerId } = usePlayer();

  const [joined, setJoined] = useState(false);

  // If we land directly on /lobby/:code without a state (e.g. hard refresh),
  // redirect to home to re-join
  useEffect(() => {
    console.log("[lobby] state/joined check — state:", !!state, "joined:", joined);
    if (!state && joined) {
      console.log("[lobby] no state after join, redirecting home");
      navigate("/");
    }
  }, [state, joined, navigate]);

  useEffect(() => {
    setJoined(true);
  }, []);

  // Navigate to game when phase changes from lobby
  useEffect(() => {
    if (state && state.phase !== "lobby") {
      navigate(`/room/${code}`);
    }
  }, [state, code, navigate]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Connecting...</p>
      </div>
    );
  }

  const self = state.players.find((p) => p.playerId === playerId);
  const isHost = self?.isHost ?? false;

  const handleStart = () => {
    socket.emit("room:start");
  };

  const handleUpdateSettings = (settings: Partial<GameSettings>) => {
    socket.emit("room:update-settings", settings);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Room code */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <RoomCodeDisplay code={state.roomCode} />
        </div>

        {/* Players */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <PlayerList players={state.players} selfPlayerId={playerId} />
        </div>

        {/* Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <GameSettingsPanel
            settings={state.settings}
            onChange={handleUpdateSettings}
            isHost={isHost}
          />
        </div>

        {/* Start button (host only) */}
        {isHost && (
          <Button
            variant="primary"
            size="lg"
            onClick={handleStart}
            disabled={state.players.length < 1}
            className="w-full"
          >
            Start Game
          </Button>
        )}
        {!isHost && (
          <p className="text-center text-sm text-gray-600">
            Waiting for the host to start the game...
          </p>
        )}
      </div>
    </div>
  );
}
