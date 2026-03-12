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
import { useAuth } from "~/lib/AuthContext";
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
  const { user } = useAuth();
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
              selfRoles={user?.roles}
              rateLimitError={chat.rateLimitError}
              onSend={chat.sendMessage}
              onRemoveMessage={chat.removeMessage}
              onClearChat={chat.clearChat}
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
              selfRoles={user?.roles}
              rateLimitError={chat.rateLimitError}
              onSend={chat.sendMessage}
              onRemoveMessage={chat.removeMessage}
              onClearChat={chat.clearChat}
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
        <svg viewBox="0 0 37 32" className="w-8 h-8 text-white">
          <g>
            <path fill="currentColor" d="M6.371,20.055l-1.924,4.103c-0.089,0.189-0.05,0.416,0.098,0.564c0.096,0.097,0.224,0.147,0.354,0.147c0.071,0,0.143-0.015,0.21-0.046l6.774-3.139c0.777,0.095,1.489,0.141,2.17,0.141c7.779,0,14.107-4.896,14.107-10.913C28.161,4.896,21.833,0,14.054,0S-0.053,4.896-0.053,10.912C-0.053,14.645,2.338,18.032,6.371,20.055z M14.054,1c7.227,0,13.107,4.446,13.107,9.912s-5.88,9.913-13.107,9.913c-0.681,0-1.396-0.049-2.187-0.15c-0.092-0.011-0.188,0.004-0.273,0.042l-5.658,2.621l1.551-3.307c0.057-0.12,0.062-0.258,0.017-0.383s-0.139-0.228-0.26-0.283c-3.943-1.823-6.297-4.983-6.297-8.453C0.947,5.446,6.827,1,14.054,1z"/>
            <path fill="currentColor" d="M7.197,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.19-0.278,1.572-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.775-0.188-1.58,0.091-2.062,0.705c-0.382,0.485-0.517,1.115-0.369,1.727C5.917,12.587,6.486,13.156,7.197,13.328z M6.901,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.63,0.369,0.713,0.713c0.076,0.317,0.011,0.628-0.183,0.874c-0.244,0.31-0.645,0.445-1.042,0.351c-0.344-0.083-0.63-0.369-0.713-0.713C6.642,11.326,6.707,11.016,6.901,10.77z"/>
            <path fill="currentColor" d="M13.098,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.189-0.278,1.571-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.774-0.188-1.579,0.091-2.062,0.705c-0.382,0.485-0.517,1.114-0.37,1.727C11.817,12.586,12.387,13.156,13.098,13.328z M12.802,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.631,0.369,0.713,0.713c0.077,0.317,0.012,0.628-0.183,0.874c-0.243,0.311-0.644,0.446-1.042,0.351c-0.344-0.083-0.631-0.369-0.714-0.713C12.542,11.326,12.607,11.016,12.802,10.77z"/>
            <path fill="currentColor" d="M18.998,13.328c0.162,0.039,0.327,0.059,0.491,0.059c0.617,0,1.19-0.278,1.572-0.763c0.382-0.485,0.517-1.115,0.369-1.728c-0.171-0.71-0.74-1.279-1.451-1.451c-0.774-0.188-1.58,0.091-2.062,0.705c-0.382,0.485-0.517,1.114-0.369,1.727C17.719,12.587,18.288,13.156,18.998,13.328z M18.702,10.77c0.191-0.243,0.478-0.383,0.787-0.383c0.084,0,0.17,0.011,0.255,0.031c0.344,0.083,0.63,0.369,0.713,0.713c0.076,0.317,0.011,0.628-0.183,0.874c-0.244,0.31-0.646,0.445-1.042,0.351c-0.344-0.083-0.631-0.369-0.714-0.713C18.443,11.326,18.508,11.016,18.702,10.77z"/>
            <path fill="currentColor" d="M29.908,12.218c-0.268-0.075-0.543,0.073-0.622,0.337c-0.079,0.265,0.071,0.543,0.336,0.622c3.847,1.146,6.431,4.009,6.431,7.121c0,2.683-1.917,5.206-5.003,6.585c-0.214,0.096-0.333,0.327-0.286,0.557l0.59,2.861l-3.17-2.395c-0.107-0.08-0.24-0.11-0.373-0.096c-0.652,0.094-1.296,0.142-1.916,0.142c-3.661,0-7.203-1.87-8.613-4.548c-0.128-0.245-0.432-0.338-0.675-0.21c-0.244,0.129-0.338,0.431-0.209,0.675c1.575,2.993,5.481,5.083,9.498,5.083c0.601,0,1.223-0.041,1.851-0.123l4.065,3.07C31.9,31.966,32.006,32,32.113,32c0.093,0,0.186-0.025,0.267-0.077c0.176-0.111,0.265-0.32,0.223-0.523l-0.779-3.774c3.236-1.577,5.229-4.354,5.229-7.327C37.053,16.684,34.249,13.513,29.908,12.218z"/>
          </g>
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
