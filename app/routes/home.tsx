import { useState, useEffect } from "react";
import { useNavigate, Navigate, Link } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ProfileModal } from "~/components/ui/ProfileModal";
import { RoomBrowser } from "~/components/home/RoomBrowser";
import { useAuth } from "~/lib/AuthContext";
import { useSocket } from "~/lib/useSocket";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Blackjack" },
    { name: "description", content: "Multiplayer blackjack — play with friends" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { user, token, logout, updateUserChips } = useAuth();
  const socket = useSocket();

  // Refresh chips from DB every time the home screen is visited
  useEffect(() => {
    if (!user || !token) return;
    fetch(`/api/players/${user.playerId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.chips != null) updateUserChips(data.chips); })
      .catch(() => {/* silently ignore — stale chips are non-critical */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const canClaimDaily = user.lastDailyClaimed !== today;

  const handleClaimDaily = async () => {
    if (claimLoading || !canClaimDaily) return;
    setClaimLoading(true);
    try {
      const res = await fetch("/api/auth/daily-reward", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { chips: number; alreadyClaimed: boolean };
      if (!res.ok) return;
      updateUserChips(data.chips, today);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleCreate = () => {
    if (loading) return;
    setLoading(true);
    setError("");

    socket.emit(
      "room:create",
      {},
      (res) => {
        setLoading(false);
        if (res.success && res.roomCode) {
          navigate(`/lobby/${res.roomCode}`);
        } else {
          setError(res.error ?? "Failed to create room");
        }
      }
    );
  };

  /** Shared join logic — used by both the manual code form and the room browser cards. */
  const handleJoinRoom = (code: string) => {
    if (loading || joiningCode) return;
    const upper = code.trim().toUpperCase();
    setJoiningCode(upper);
    setError("");

    socket.emit(
      "room:join",
      { roomCode: upper },
      (res) => {
        setJoiningCode(null);
        if (res.success) {
          navigate(`/lobby/${upper}`);
        } else {
          setError(res.error ?? "Failed to join room");
        }
      }
    );
  };

  const handleJoin = () => {
    if (!joinCode.trim() || joiningCode) return;
    handleJoinRoom(joinCode);
  };

  return (
    <>
    <ProfileModal
      playerId={profileOpen ? user.playerId : null}
      onClose={() => setProfileOpen(false)}
    />
    <div className="min-h-screen px-4 py-12">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
      {/* Player card — centred, fixed width */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-3 select-none">♠</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Blackjack</h1>
          <p className="text-gray-500 mt-2">Multiplayer · 6-deck shoe</p>
        </div>

        {/* Player card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          {/* Player info row */}
          <button
            className="flex items-center gap-3 w-full text-left hover:bg-gray-800/50 rounded-xl transition-colors -mx-1 px-1 py-1"
            onClick={() => setProfileOpen(true)}
            title="View your profile"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{user.displayName}</p>
              <p className="text-sm text-gray-500">@{user.username}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{user.chips.toLocaleString()}</p>
              <p className="text-xs text-gray-500">chips</p>
            </div>
          </button>

          {/* Daily reward */}
          <Button
            variant={canClaimDaily ? "primary" : "secondary"}
            size="md"
            onClick={handleClaimDaily}
            disabled={!canClaimDaily || claimLoading}
          >
            {claimLoading
              ? "Claiming..."
              : canClaimDaily
              ? "Claim Daily Reward (+2,500 chips)"
              : "Daily Reward Claimed ✓"}
          </Button>

          {/* Room actions */}
          {mode === "none" && (
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => setMode("create")}
              >
                Create Room
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
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
                disabled={loading}
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
                disabled={!!joiningCode || joinCode.length < 6}
              >
                {joiningCode ? "Joining..." : "Join Room"}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setMode("none")}>
                Back
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          {/* Footer actions */}
          <div className="flex items-center justify-center gap-4 self-center">
            <Link
              to="/leaderboard"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Leaderboard
            </Link>
            <span className="text-gray-800 text-xs">·</span>
            <Link
              to="/settings"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Account Settings
            </Link>
            <span className="text-gray-800 text-xs">·</span>
            <button
              onClick={logout}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Room browser */}
      <RoomBrowser onJoin={handleJoinRoom} joiningCode={joiningCode} />

      </div>
    </div>
    </>
  );
}
