import { useState, useEffect } from "react";
import { useNavigate, Navigate, Link } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ProfileModal } from "~/components/ui/ProfileModal";
import { DisplayName } from "~/components/ui/DisplayName";
import { RoomBrowser } from "~/components/home/RoomBrowser";
import { useAuth } from "~/lib/AuthContext";
import { useSocket } from "~/lib/useSocket";
import { hasPermission } from "~/lib/permissions";
import { consumeKickNotice, type KickNotice } from "~/lib/useKickNotice";
import { Modal } from "~/components/ui/Modal";

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

  // If staff kicked us from a table, useKickNotice sent us here and left the
  // reason behind. Read it once on mount and explain what happened.
  const [kickNotice, setKickNotice] = useState<KickNotice | null>(null);
  useEffect(() => {
    setKickNotice(consumeKickNotice());
  }, []);

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
      selfPlayerId={user.playerId}
    />

    {/* Shown once after staff removed this player from a table. */}
    <Modal
      isOpen={kickNotice !== null}
      onClose={() => setKickNotice(null)}
      title="Removed from table"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-lg">
            🛡️
          </span>
          <p className="text-sm text-gray-300 leading-relaxed">
            A staff member removed you from that table. Your chips are unaffected
            and you can join another table whenever you like.
          </p>
        </div>

        {kickNotice?.reason && (
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Reason</p>
            <p className="mt-0.5 text-sm text-gray-200 break-words">{kickNotice.reason}</p>
          </div>
        )}

        <Button variant="primary" size="md" onClick={() => setKickNotice(null)}>
          Got it
        </Button>
      </div>
    </Modal>

    {/* Top nav bar */}
    <nav className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur border-b border-gray-800">
      <div className="w-full max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-white text-xl">♠</span>
          <span className="font-black text-white tracking-tight">Blackjack</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            to="/leaderboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </Link>
          {/* Staff only. The server re-checks on every admin call; this just hides the entry point. */}
          {hasPermission(user?.roles, "admin.access") && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 hover:bg-gray-800 transition-colors"
            >
              <span>🛡️</span>
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
          >
            <span>→</span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>

    <div className="min-h-screen px-4 py-12">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
      {/* Player card — centred, fixed width */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
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
              <DisplayName displayName={user.displayName} nameEffect={user.equippedNameEffect} className="font-semibold truncate" />
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
        </div>
      </div>

      {/* Room browser */}
      <RoomBrowser onJoin={handleJoinRoom} joiningCode={joiningCode} />

      </div>
    </div>
    </>
  );
}
