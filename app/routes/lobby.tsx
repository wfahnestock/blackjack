import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/Button";
import { RoomCodeDisplay } from "~/components/lobby/RoomCodeDisplay";
import { PlayerList } from "~/components/lobby/PlayerList";
import { GameSettingsPanel } from "~/components/lobby/GameSettings";
import { ProfileModal } from "~/components/ui/ProfileModal";
import { ChatPanel } from "~/components/chat/ChatPanel";
import { useSocket } from "~/lib/useSocket";
import { useGameState } from "~/lib/useGameState";
import { usePlayer } from "~/lib/usePlayer";
import { useChat } from "~/lib/useChat";
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
  const chat = useChat(socket);

  const [joined, setJoined] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

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

  function handleMobileChatOpen() {
    setMobileChatOpen(true);
    chat.openPanel();
  }
  function handleMobileChatClose() {
    setMobileChatOpen(false);
    chat.closePanel();
  }

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
    <>
      <ProfileModal
        playerId={profilePlayerId}
        onClose={() => setProfilePlayerId(null)}
      />

      {/* Mobile chat overlay */}
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden bg-black/60 backdrop-blur-sm">
          <div className="mt-auto h-[70vh] flex flex-col">
            <ChatPanel
              messages={chat.messages}
              selfPlayerId={playerId}
              rateLimitError={chat.rateLimitError}
              onSend={chat.sendMessage}
              onClose={handleMobileChatClose}
              className="flex-1 rounded-b-none"
            />
          </div>
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        {/* Responsive layout: single-column on mobile, two-column on lg+ */}
        <div className="w-full max-w-5xl flex gap-6 items-start">
          {/* Main lobby content */}
          <div className="flex-1 min-w-0 max-w-lg mx-auto lg:mx-0 flex flex-col gap-6">
            {/* Room code */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <RoomCodeDisplay code={state.roomCode} />
            </div>

            {/* Players */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <PlayerList
                players={state.players}
                selfPlayerId={playerId}
                onPlayerClick={setProfilePlayerId}
              />
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

          {/* Desktop chat sidebar */}
          <div className="hidden lg:flex w-72 shrink-0 sticky top-8 flex-col">
            <ChatPanel
              messages={chat.messages}
              selfPlayerId={playerId}
              rateLimitError={chat.rateLimitError}
              onSend={chat.sendMessage}
              className="h-[600px]"
            />
          </div>
        </div>
      </div>

      {/* Mobile chat FAB */}
      <button
        onClick={handleMobileChatOpen}
        className="
          fixed bottom-6 right-6 z-40 lg:hidden
          w-14 h-14 rounded-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800
          shadow-lg shadow-emerald-900/40 transition-colors
          flex items-center justify-center relative
        "
        aria-label="Open chat"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
          <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
          <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
        </svg>
        {chat.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
