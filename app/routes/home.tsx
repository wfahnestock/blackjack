import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ProfileModal } from "~/components/ui/ProfileModal";
import { DisplayName } from "~/components/ui/DisplayName";
import { RoomBrowser } from "~/components/home/RoomBrowser";
import { useAuth } from "~/lib/AuthContext";
import { useSocket } from "~/lib/useSocket";
import { consumeKickNotice, type KickNotice } from "~/lib/useKickNotice";
import { Modal } from "~/components/ui/Modal";
import { chipStyle, chipCenterStyle } from "~/lib/chipStyle";
import { CHIP_DENOMINATIONS } from "~/lib/constants";
import { ShellLayout } from "~/components/shell/ShellLayout";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Blackjack" },
    { name: "description", content: "Multiplayer blackjack — play with friends" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { user, token, updateUserChips } = useAuth();
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

  // Show the largest chip the player could actually cover, so the icon next to
  // the bankroll reflects how flush they are.
  const topChipDenom =
    [...CHIP_DENOMINATIONS].reverse().find((d) => d <= user.chips) ?? CHIP_DENOMINATIONS[0];

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

    {/* Content is vertically centred so the composition holds whether or not
        any tables are open. */}
    <ShellLayout contentClassName="px-4 py-10 flex items-center">
      <div className="w-full max-w-5xl mx-auto grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">

        {/* ── Left: bankroll, identity, actions ── */}
        <div>
          <p className="casino-eyebrow mb-2.5">Bankroll</p>

          <div className="flex items-center gap-4">
            {/* A real chip rather than bold text — same component the table uses. */}
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={chipStyle(topChipDenom, 46)}
            >
              <span
                className="font-bold leading-none"
                style={{ ...chipCenterStyle(topChipDenom), fontSize: "9px" }}
              >
                {topChipDenom}
              </span>
            </span>
            <p className="font-extrabold tracking-[-0.035em] text-[46px] leading-[0.9] text-[#f7edd4] tabular-nums">
              {user.chips.toLocaleString()}
              <span className="font-display align-super ml-2 text-[12px] font-normal uppercase tracking-[0.18em] text-[var(--parchment-dim)]">
                chips
              </span>
            </p>
          </div>

          {/* Claimable state is a real button — bordered, with a verb and a hover
              state — because a bare text line read as a status and nobody
              realised it was clickable. Once claimed it collapses to a quiet
              confirmation, since there's nothing left to do. */}
          <div className="mt-3">
            {canClaimDaily ? (
              <button
                onClick={handleClaimDaily}
                disabled={claimLoading}
                className="group inline-flex items-center gap-2.5 rounded-md border border-emerald-400/40 bg-emerald-400/10 pl-3 pr-3.5 py-2 text-[12px] font-semibold text-emerald-200 transition-all hover:border-emerald-300/70 hover:bg-emerald-400/20 hover:text-emerald-100 disabled:opacity-50 disabled:cursor-wait"
              >
                <i className="fa-solid fa-gift text-[11px]" />
                <span>{claimLoading ? "Claiming…" : "Claim daily reward"}</span>
                <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-100 group-hover:bg-emerald-400/30">
                  +2,500
                </span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 text-[11.5px] text-[var(--parchment-dim)]">
                <i className="fa-solid fa-check text-[9px]" />
                Daily reward claimed
              </span>
            )}
          </div>

          <hr className="brass-rule my-5" />

          <button
            className="flex items-center gap-3 w-full text-left group"
            onClick={() => setProfileOpen(true)}
            title="View your profile"
          >
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 border-2 border-[var(--brass)]/55"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <DisplayName
                displayName={user.displayName}
                nameEffect={user.equippedNameEffect}
                className="font-display text-sm text-[#eddfbe] truncate block leading-tight"
              />
              <span className="text-[10.5px] text-[#7d6f4d]">@{user.username}</span>
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[var(--parchment-dim)] border border-[var(--brass)]/20 rounded px-2.5 py-1.5 group-hover:border-[var(--brass)]/45 transition-colors">
              Profile
            </span>
          </button>

          {/* Room actions */}
          <div className="mt-5">
            {mode === "none" && (
              <div className="flex gap-2.5">
                <button
                  onClick={() => setMode("create")}
                  className="btn-brass flex-[1.25] rounded-md py-3 text-[13px] font-extrabold uppercase tracking-[0.09em] transition-all"
                >
                  Create Table
                </button>
                <button
                  onClick={() => setMode("join")}
                  className="btn-brass-ghost flex-1 rounded-md py-3 text-[13px] font-bold uppercase tracking-[0.09em] transition-colors"
                >
                  Join by Code
                </button>
              </div>
            )}

            {mode === "create" && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="btn-brass rounded-md py-3 text-[13px] font-extrabold uppercase tracking-[0.09em] transition-all"
                >
                  {loading ? "Dealing you in…" : "Create Table"}
                </button>
                <button
                  onClick={() => setMode("none")}
                  className="text-[11px] uppercase tracking-[0.12em] text-[var(--parchment-dim)] hover:text-[#d5c398] transition-colors py-1"
                >
                  Back
                </button>
              </div>
            )}

            {mode === "join" && (
              <div className="flex flex-col gap-2.5">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  aria-label="Room code"
                  className="w-full rounded-md bg-black/30 border border-[var(--brass)]/25 px-3 py-3 font-mono text-center text-lg tracking-[0.35em] uppercase text-[#f0e4c6] placeholder:text-[#6b6144] focus:border-[var(--brass)]/60 focus:outline-none"
                />
                <button
                  onClick={handleJoin}
                  disabled={!!joiningCode || joinCode.length < 6}
                  className="btn-brass rounded-md py-3 text-[13px] font-extrabold uppercase tracking-[0.09em] transition-all"
                >
                  {joiningCode ? "Joining…" : "Take a Seat"}
                </button>
                <button
                  onClick={() => setMode("none")}
                  className="text-[11px] uppercase tracking-[0.12em] text-[var(--parchment-dim)] hover:text-[#d5c398] transition-colors py-1"
                >
                  Back
                </button>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>
        </div>

        {/* ── Right: open tables ── */}
        <div className="lg:border-l lg:border-[var(--brass)]/15 lg:pl-8">
          <RoomBrowser onJoin={handleJoinRoom} joiningCode={joiningCode} />
        </div>

      </div>
    </ShellLayout>
    </>
  );
}
