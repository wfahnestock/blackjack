import type { Player } from "./types.js";

export interface SeatPlacement {
  player: Player;
  /** Horizontal center of the seat as a percentage of the table container (0-100). */
  xPct: number;
  /** Vertical center of the seat as a percentage of the table container (0-100). */
  yPct: number;
  /** True for the local ("hero") player, who is pinned to the bottom-center seat. */
  isSelf: boolean;
}

/**
 * Arc geometry, expressed as percentages of the felt container. Seats sit on an
 * ellipse whose focus is up near the dealer, so angle 0 lands at bottom-center
 * and larger angles fan up toward the dealer's left and right.
 */
const ARC = { cx: 50, cy: 38, rx: 40, ry: 28, maxAngleDeg: 66 } as const;

function placeOnArc(angleDeg: number): { xPct: number; yPct: number } {
  const a = (angleDeg * Math.PI) / 180;
  return {
    xPct: ARC.cx + Math.sin(a) * ARC.rx,
    yPct: ARC.cy + Math.cos(a) * ARC.ry,
  };
}

/**
 * Places players around the felt arc with the local player ("hero") always at
 * the bottom-center seat, and every other player fanned outward alternating
 * right then left. This keeps "you" centered no matter how many others are
 * seated or which server seat index they hold.
 *
 * If there is no local player at the table (spectator/edge case), the whole
 * group is centered on the arc instead.
 */
export function computeHeroSeats(
  players: Player[],
  selfPlayerId: string
): SeatPlacement[] {
  const self = players.find((p) => p.playerId === selfPlayerId) ?? null;
  const others = players
    .filter((p) => p.playerId !== selfPlayerId)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  if (!self) return centerGroup(players);

  const placements: SeatPlacement[] = [
    { player: self, ...placeOnArc(0), isSelf: true },
  ];

  const step = ARC.maxAngleDeg / Math.max(1, Math.ceil(others.length / 2));
  others.forEach((player, i) => {
    const rank = Math.floor(i / 2) + 1;
    const side = i % 2 === 0 ? 1 : -1; // first other to the right, then left, then out
    placements.push({ player, ...placeOnArc(side * rank * step), isSelf: false });
  });

  return placements;
}

/** Even spread across the full arc, used when there is no hero to center on. */
function centerGroup(players: Player[]): SeatPlacement[] {
  const n = players.length;
  const span = ARC.maxAngleDeg * 2;
  return players.map((player, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { player, ...placeOnArc(-ARC.maxAngleDeg + t * span), isSelf: false };
  });
}
