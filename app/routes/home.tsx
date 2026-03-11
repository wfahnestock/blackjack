import { useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { PlayerSetup } from "~/components/lobby/PlayerSetup";
import { usePlayer } from "~/lib/usePlayer";
import { useSocket } from "~/lib/useSocket";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Blackjack" },
    { name: "description", content: "Multiplayer blackjack — play with friends" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const socket = useSocket();
  const { playerId, displayName, avatarColor, setDisplayName, setAvatarColor } = usePlayer();

  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canProceed = displayName.trim().length >= 2;

  const handleCreate = () => {
    if (!canProceed || loading) return;
    console.log("[home] handleCreate fired, socket connected:", socket.connected);
    setLoading(true);
    setError("");

    socket.emit(
      "room:create",
      { displayName: displayName.trim(), playerId, avatarColor },
      (res) => {
        console.log("[home] room:create response:", res);
        setLoading(false);
        if (res.success && res.roomCode) {
          navigate(`/lobby/${res.roomCode}`);
        } else {
          setError(res.error ?? "Failed to create room");
        }
      }
    );
  };

  const handleJoin = () => {
    if (!canProceed || !joinCode.trim() || loading) return;
    setLoading(true);
    setError("");

    socket.emit(
      "room:join",
      { roomCode: joinCode.trim().toUpperCase(), displayName: displayName.trim(), playerId, avatarColor },
      (res) => {
        setLoading(false);
        if (res.success) {
          navigate(`/lobby/${joinCode.trim().toUpperCase()}`);
        } else {
          setError(res.error ?? "Failed to join room");
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-3 select-none">♠</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Blackjack</h1>
          <p className="text-gray-500 mt-2">Multiplayer · 6-deck shoe</p>
        </div>

        {/* Player setup */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6">
          <PlayerSetup
            displayName={displayName}
            avatarColor={avatarColor}
            onNameChange={setDisplayName}
            onColorChange={setAvatarColor}
          />

          {!canProceed && displayName.length > 0 && (
            <p className="text-xs text-red-400">Name must be at least 2 characters</p>
          )}

          {/* Action buttons */}
          {mode === "none" && (
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={!canProceed}
                onClick={() => setMode("create")}
              >
                Create Room
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={!canProceed}
                onClick={() => setMode("join")}
              >
                Join Room
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                disabled={loading || !canProceed}
              >
                {loading ? "Creating..." : "Create Room"}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setMode("none")}>
                Back
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="flex flex-col gap-3">
              <Input
                label="Room Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="font-mono text-center text-lg tracking-widest uppercase"
              />
              <Button
                variant="primary"
                size="lg"
                onClick={handleJoin}
                disabled={loading || !canProceed || joinCode.length < 6}
              >
                {loading ? "Joining..." : "Join Room"}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setMode("none")}>
                Back
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
