import type { Card } from "~/lib/types";

interface PlayingCardProps {
  card: Card;
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

export function PlayingCard({ card, small = false, className = "", style }: PlayingCardProps) {
  if (card.faceDown) {
    return <CardBack small={small} className={className} style={style} />;
  }

  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];
  const w = small ? "w-10" : "w-14";
  const h = small ? "h-14" : "h-20";
  const text = small ? "text-sm" : "text-base";

  return (
    <div
      className={`
        ${w} ${h} rounded-lg bg-white border border-gray-200 shadow-md
        flex flex-col justify-between p-1 select-none card-appear
        ${className}
      `}
      style={style}
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

function CardBack({ small = false, className = "", style }: { small?: boolean; className?: string; style?: React.CSSProperties }) {
  const w = small ? "w-10" : "w-14";
  const h = small ? "h-14" : "h-20";

  return (
    <div
      className={`
        ${w} ${h} rounded-lg bg-blue-900 border border-blue-700 shadow-md
        flex items-center justify-center select-none card-appear
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
