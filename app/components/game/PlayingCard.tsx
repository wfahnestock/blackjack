import { useState, useCallback } from "react";
import type { Card } from "~/lib/types";
import { cardSkinFaceClass, cardSkinBackClass } from "~/lib/cardSkins";

interface PlayingCardProps {
  card: Card;
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Card skin key from the owning player (or dealer).  Null/undefined = default styling. */
  skin?: string | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

export function PlayingCard({ card, small = false, className = "", style, skin }: PlayingCardProps) {
  const isVoid = skin === "void";
  const [voidParallax, setVoidParallax] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVoid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    const dy = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    setVoidParallax({
      "--void-px": `${(dx * 5).toFixed(1)}px`,
      "--void-py": `${(dy * 5).toFixed(1)}px`,
      "--void-fx": `${(dx * 2.2).toFixed(1)}px`,
      "--void-fy": `${(dy * 2.2).toFixed(1)}px`,
    } as React.CSSProperties);
  }, [isVoid]);

  const handleMouseLeave = useCallback(() => {
    if (!isVoid) return;
    setVoidParallax({});
  }, [isVoid]);

  if (card.faceDown) {
    return <CardBack small={small} className={className} style={style} skin={skin} />;
  }

  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];
  const w = small ? "w-11" : "w-14";
  const h = small ? "h-16" : "h-20";
  const text = small ? "text-sm" : "text-base";
  const faceClass = cardSkinFaceClass(skin);

  return (
    <div
      className={`
        ${w} ${h} rounded-lg bg-white border border-gray-200 shadow-md
        flex flex-col justify-between p-1 select-none card-appear
        ${faceClass}
        ${className}
      `}
      style={{ ...style, ...voidParallax }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`font-bold leading-none ${text} ${isRed ? "text-red-600" : "text-gray-900"}`}>
        <div>{card.rank}</div>
        <div>{symbol}</div>
      </div>
      <div
        className={`font-bold leading-none ${text} ${isRed ? "text-red-600" : "text-gray-900"} self-end rotate-180`}
      >
        <div>{card.rank}</div>
        <div>{symbol}</div>
      </div>
    </div>
  );
}

function CardBack({ small = false, className = "", style, skin }: { small?: boolean; className?: string; style?: React.CSSProperties; skin?: string | null }) {
  const w = small ? "w-11" : "w-14";
  const h = small ? "h-16" : "h-20";
  const backClass = cardSkinBackClass(skin);

  return (
    <div
      className={`
        ${w} ${h} rounded-lg bg-blue-900 border border-blue-700 shadow-md
        flex items-center justify-center select-none card-appear
        ${backClass}
        ${className}
      `}
      style={style}
    >
      <div
        className="w-full h-full rounded-md border-2 border-blue-600 m-0.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #1e3a5f 0px, #1e3a5f 4px, #1a3355 4px, #1a3355 8px)",
        }}
      />
    </div>
  );
}
