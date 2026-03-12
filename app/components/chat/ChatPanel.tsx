import { useState, useEffect, useRef } from "react";
import type { ChatMessage, RoleInfo } from "~/lib/types";
import { MAX_CHAT_MESSAGE_LENGTH } from "~/lib/constants";

/**
 * Maps the `color` key stored in the DB to a Tailwind text-color class.
 * All strings are written out in full so Tailwind's scanner includes them.
 */
const ROLE_TEXT_COLORS: Record<string, string> = {
  sky:     "text-sky-400",
  amber:   "text-amber-400",
  violet:  "text-violet-400",
  emerald: "text-emerald-400",
  rose:    "text-rose-400",
  blue:    "text-blue-400",
  purple:  "text-purple-400",
  red:     "text-red-400",
  default: "text-gray-400",
};

interface ChatPanelProps {
  messages: ChatMessage[];
  selfPlayerId: string;
  rateLimitError?: string;
  onSend: (message: string) => void;
  /** If provided, a close (×) button is shown — used for mobile overlays. */
  onClose?: () => void;
  className?: string;
}

function ChatRoleIcon({ role }: { role: RoleInfo }) {
  const colorClass = ROLE_TEXT_COLORS[role.color] ?? ROLE_TEXT_COLORS.default;
  return (
    <i
      className={`fa-solid ${role.icon} text-[10px] shrink-0 ${colorClass}`}
      title={role.label}
    />
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  messages,
  selfPlayerId,
  rateLimitError,
  onSend,
  onClose,
  className = "",
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever a new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return;
    onSend(text);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const charsRemaining = MAX_CHAT_MESSAGE_LENGTH - draft.length;
  const overLimit = charsRemaining < 0;

  return (
    <div
      className={`flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <span className="text-sm font-semibold text-gray-300">Chat</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 rounded"
            aria-label="Close chat"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-4 select-none">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.playerId === selfPlayerId;
          return (
            <div key={msg.messageId} className={`flex flex-col gap-0.5 ${isSelf ? "items-end" : "items-start"}`}>
              {/* Name + time row */}
              <div className={`flex items-center gap-1.5 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: msg.avatarColor }}
                />
                <span className="text-xs font-medium text-gray-400 truncate max-w-[100px]">
                  {isSelf ? "You" : msg.displayName}
                </span>
                {/* Role icons — one per role, icon only with hover tooltip */}
                {msg.roles?.map((role) => (
                  <ChatRoleIcon key={role.id} role={role} />
                ))}
                <span className="text-xs text-gray-600">{formatTime(msg.timestamp)}</span>
              </div>

              {/* Bubble */}
              <div
                className={`
                  max-w-[85%] px-3 py-1.5 rounded-xl text-sm leading-snug break-words
                  ${isSelf
                    ? "bg-emerald-800/60 text-emerald-50 rounded-tr-sm"
                    : "bg-gray-800 text-gray-200 rounded-tl-sm"
                  }
                  ${msg.censored ? "italic text-gray-500" : ""}
                `}
              >
                {msg.censored ? "[message removed]" : msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-3 py-2.5 shrink-0 flex flex-col gap-1.5">
        {rateLimitError && (
          <p className="text-xs text-red-400 leading-tight">{rateLimitError}</p>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            maxLength={MAX_CHAT_MESSAGE_LENGTH + 10} // let them type slightly over so they see the counter
            className={`
              flex-1 min-w-0 bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100
              placeholder:text-gray-600 border transition-colors
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
              ${overLimit ? "border-red-500" : "border-gray-700"}
            `}
          />
          <button
            type="submit"
            disabled={!draft.trim() || overLimit}
            className="shrink-0 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800
              text-white text-sm font-medium transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
        {draft.length > MAX_CHAT_MESSAGE_LENGTH - 20 && (
          <p className={`text-xs text-right ${overLimit ? "text-red-400" : "text-gray-600"}`}>
            {charsRemaining} chars remaining
          </p>
        )}
      </div>
    </div>
  );
}
