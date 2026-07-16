import type { ShoeState, Card } from "~/lib/types";
import { formatChips } from "~/lib/handUtils";
import { PlayingCard } from "./PlayingCard";

interface DealerFurnitureProps {
  shoe: ShoeState;
  hiLoCount: number | null;
  minBet: number;
  maxBet: number;
  /** Ref attached to the shoe's dealing slot; dealt cards fly out from here. */
  slotRef?: React.Ref<HTMLDivElement>;
}

// A face-down card; rank/suit are ignored for the back, so any values work.
const BACK: Card = { suit: "spades", rank: "2", faceDown: true };

/**
 * Casino furniture that sits on the felt around the dealer: a discard tray with
 * deck/count readouts (top-left), a min/max limit sign (top-center), and the
 * card shoe with penetration (top-right). The cards in the shoe and tray reuse
 * the real PlayingCard back so the deck matches the cards in play.
 */
export function DealerFurniture({ shoe, hiLoCount, minBet, maxBet, slotRef }: DealerFurnitureProps) {
  const pct = Math.round(shoe.penetration * 100);
  const decksLeft = (shoe.cardsRemaining / 52).toFixed(1);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {/* Discard tray — top-left */}
      <div className="absolute flex flex-col items-center gap-1" style={{ left: "6%", top: "12%" }}>
        <div className="relative" style={{ width: 82, height: 62 }}>
          {/* glass holder */}
          <div
            className="absolute inset-0 rounded-md"
            style={{
              background: "linear-gradient(155deg, rgba(205,220,230,0.17), rgba(28,38,44,0.34))",
              border: "1px solid rgba(255,255,255,0.28)",
              boxShadow:
                "inset 0 4px 9px rgba(0,0,0,0.45), inset 0 -3px 3px rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.45)",
            }}
          />
          {/* stack of discarded card backs */}
          <div className="absolute" style={{ left: 17, top: 7, transform: "scale(0.68) rotate(-5deg)", transformOrigin: "top left" }}>
            <PlayingCard card={BACK} small />
          </div>
          <div className="absolute" style={{ left: 25, top: 11, transform: "scale(0.68) rotate(4deg)", transformOrigin: "top left" }}>
            <PlayingCard card={BACK} small />
          </div>
          {/* front glass lip */}
          <div
            className="absolute left-0 right-0 bottom-0 rounded-b-md"
            style={{
              height: 12,
              background: "linear-gradient(180deg, rgba(210,225,235,0.24), rgba(160,180,190,0.10))",
              borderTop: "1px solid rgba(255,255,255,0.30)",
            }}
          />
        </div>
        <div className="px-2 py-0.5 rounded bg-black/45 text-[10px] text-gray-200 font-medium whitespace-nowrap">
          {decksLeft} decks left
        </div>
        {hiLoCount !== null && (
          <div className="px-2 py-0.5 rounded bg-black/45 text-[10px] font-bold whitespace-nowrap">
            <span className="text-gray-400">RC </span>
            <span className={hiLoCount > 2 ? "text-emerald-400" : hiLoCount < -2 ? "text-red-400" : "text-gray-100"}>
              {hiLoCount > 0 ? `+${hiLoCount}` : hiLoCount}
            </span>
          </div>
        )}
      </div>

      {/* Min/Max limit sign — top-center */}
      <div className="absolute" style={{ left: "50%", top: "5%", transform: "translateX(-50%)" }}>
        <div
          className="px-3 py-1 rounded-md border border-amber-900/70 text-center font-mono leading-tight"
          style={{ background: "#0c0a06", boxShadow: "inset 0 0 10px rgba(0,0,0,0.7)" }}
        >
          <div className="text-[10px] tracking-widest text-amber-400">MIN {formatChips(minBet)}</div>
          <div className="text-[10px] tracking-widest text-amber-400">MAX {formatChips(maxBet)}</div>
        </div>
      </div>

      {/* Card shoe — top-right */}
      <div className="absolute flex flex-col items-center gap-1" style={{ right: "6%", top: "12%" }}>
        <div className="relative" style={{ width: 88, height: 60 }}>
          {/* shoe box (felt shows in the thin strip above) */}
          <div
            className="absolute left-0 right-0 rounded-[10px]"
            style={{
              top: 4,
              bottom: 0,
              background: "linear-gradient(180deg,#3c3c45 0%,#191920 46%,#050506 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 5px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)",
            }}
          />
          {/* deck lying long-ways: the blue card back sits on top of the stacked
              cut edges of the cards beneath it, so it reads as a full deck. The
              back matches the PlayingCard back used in play. */}
          <div className="absolute left-1/2" style={{ top: 8, width: 64, height: 38, transform: "translateX(-50%)" }}>
            {/* stacked card edges (deck thickness) */}
            <div
              className="absolute left-0 right-0 bottom-0 rounded-b-[4px] rounded-t-[2px]"
              style={{
                height: 38,
                background: "repeating-linear-gradient(180deg,#eef0f3 0px,#eef0f3 1.4px,#a9afb8 1.4px,#a9afb8 3px)",
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow: "0 3px 5px rgba(0,0,0,0.55)",
              }}
            />
            {/* top card back */}
            <div
              className="absolute left-0 right-0 top-0 rounded-[5px]"
              style={{
                height: 25,
                backgroundColor: "#1e3a8a",
                backgroundImage: "repeating-linear-gradient(45deg,#1e3a5f 0px,#1e3a5f 4px,#1a3355 4px,#1a3355 8px)",
                border: "2px solid #2563eb",
                boxShadow: "0 2px 3px rgba(0,0,0,0.45)",
              }}
            />
          </div>
          {/* dealing slot — dealt cards fly out from here */}
          <div
            ref={slotRef}
            className="absolute left-3 right-3 rounded-full"
            style={{
              bottom: 6,
              height: 3,
              background: "linear-gradient(180deg,rgba(0,0,0,0.85),rgba(0,0,0,0.45))",
              boxShadow: "inset 0 1px 1px rgba(0,0,0,0.8)",
            }}
          />
        </div>
        <div className="px-2 py-0.5 rounded bg-black/45 text-[10px] text-gray-200 font-medium whitespace-nowrap">
          {pct}% dealt
        </div>
      </div>
    </div>
  );
}
