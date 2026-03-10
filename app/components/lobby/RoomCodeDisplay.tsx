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
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Room Code
      </span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-4xl font-black tracking-[0.25em] text-white">
          {code}
        </span>
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-gray-600">Share this code with friends to join</p>
    </div>
  );
}
