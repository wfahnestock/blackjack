import { useState } from "react";

interface RoomCodeDisplayProps {
  code: string;
}

export function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="casino-eyebrow">Room Code</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-4xl font-black tracking-[0.25em] text-[#f7edd4]">
          {code}
        </span>
        <button
          onClick={copy}
          className="btn-brass-ghost rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-[#7d6f4d]">Share this code with friends to join</p>
    </div>
  );
}
