import { useState, useEffect, useRef } from "react";
import type { ChatMessage, RoleInfo } from "~/lib/types";
import { MAX_CHAT_MESSAGE_LENGTH } from "~/lib/constants";
import { hasPermission } from "~/lib/permissions";
import { DisplayName } from "~/components/ui/DisplayName";

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
  selfRoles?: RoleInfo[];
  rateLimitError?: string;
  onSend: (message: string) => void;
  onRemoveMessage?: (messageId: string) => void;
  onClearChat?: () => void;
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
  selfRoles = [],
  rateLimitError,
  onSend,
  onRemoveMessage,
  onClearChat,
  onClose,
  className = "",
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Permission-gated rather than role-name gated. The server re-checks both of
  // these; this only decides whether the control renders.
  const canClearChat = hasPermission(selfRoles, "chat.clear");
  const canDeleteMessage = hasPermission(selfRoles, "chat.delete_message");

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
      className={`flex flex-col overflow-hidden rounded-lg border border-[var(--brass)]/18 bg-black/45 backdrop-blur-sm ${className}`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--brass)]/15 px-4 py-2.5">
        <span className="casino-eyebrow">Chat</span>
        <div className="flex items-center gap-2">
          {canClearChat && onClearChat && (
            <button
              onClick={onClearChat}
              className="rounded p-0.5 text-[#6b6144] transition-colors hover:text-red-300"
              aria-label="Clear chat"
              title="Clear all messages"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
                <path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15H5.405a1.748 1.748 0 0 1-1.741-1.576l-.66-6.6a.75.75 0 1 1 1.492-.149Z" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-0.5 text-[#6b6144] transition-colors hover:text-[var(--parchment)]"
              aria-label="Close chat"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="mt-4 select-none text-center text-[11.5px] text-[#6b6144]">
            No messages yet. Say hello.
          </p>
        )}
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.messageId} className="flex items-center justify-center py-1">
                <span className="select-none text-[11px] italic text-[var(--parchment-dim)]">
                  {msg.message}
                </span>
              </div>
            );
          }

          const isSelf = msg.playerId === selfPlayerId;
          return (
            <div key={msg.messageId} className={`flex flex-col gap-0.5 group ${isSelf ? "items-end" : "items-start"}`}>
              {/* Name + time row */}
              <div className={`flex items-center gap-1.5 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: msg.avatarColor }}
                />
                {isSelf ? (
                  <span className="max-w-[100px] truncate text-[11px] font-medium text-[var(--parchment-dim)]">
                    You
                  </span>
                ) : (
                  <DisplayName
                    displayName={msg.displayName}
                    nameEffect={msg.nameEffect}
                    roles={msg.roles}
                    className="max-w-[100px] truncate text-[11px] font-medium text-[#c7b78c]"
                  />
                )}
                {/* Role icons — one per role, icon only with hover tooltip */}
                {msg.roles?.map((role) => (
                  <ChatRoleIcon key={role.id} role={role} />
                ))}
                <span className="text-[10.5px] tabular-nums text-[#6b6144]">
                  {formatTime(msg.timestamp)}
                </span>
              </div>

              {/* Bubble row: bubble + optional remove button */}
              <div className={`flex items-center gap-1.5 max-w-[90%] ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className={`
                    min-w-0 break-words rounded-lg px-3 py-1.5 text-[13px] leading-snug border
                    ${isSelf
                      ? "rounded-tr-sm border-[var(--brass)]/30 bg-[var(--brass)]/15 text-[#f0e4c6]"
                      : "rounded-tl-sm border-white/[0.07] bg-white/[0.05] text-[#ded0ac]"
                    }
                    ${msg.censored ? "italic text-[#6b6144]" : ""}
                  `}
                >
                  {msg.censored ? "message removed" : msg.message}
                </div>
                {canDeleteMessage && !msg.censored && onRemoveMessage && (
                  <button
                    onClick={() => onRemoveMessage(msg.messageId)}
                    className="shrink-0 rounded p-0.5 text-[#6b6144] opacity-0 transition-all hover:text-red-300 group-hover:opacity-100"
                    aria-label="Remove message"
                    title="Remove message"
                  >
                    <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                      <path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15H5.405a1.748 1.748 0 0 1-1.741-1.576l-.66-6.6a.75.75 0 1 1 1.492-.149Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-[var(--brass)]/15 px-3 py-2.5">
        {rateLimitError && (
          <p className="text-[11px] leading-tight text-red-300">{rateLimitError}</p>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something…"
            maxLength={MAX_CHAT_MESSAGE_LENGTH + 10} // let them type slightly over so they see the counter
            className={`casino-input min-w-0 flex-1 px-3 py-2 text-[13px] ${
              overLimit ? "!border-red-400/60" : ""
            }`}
          />
          <button
            type="submit"
            disabled={!draft.trim() || overLimit}
            className="btn-brass shrink-0 rounded-md px-3.5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] transition-all disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
        {draft.length > MAX_CHAT_MESSAGE_LENGTH - 20 && (
          <p className={`text-right text-[11px] ${overLimit ? "text-red-300" : "text-[#6b6144]"}`}>
            {charsRemaining} chars remaining
          </p>
        )}
      </div>
    </div>
  );
}
