interface TableFeltProps {
  className?: string;
  /** Equipped table/felt skin key; drives the felt color. */
  skin?: string | null;
}

/** Felt color ramps (light center -> mid -> dark edge) per equipped skin. */
const FELT_PALETTES: Record<string, [string, string, string]> = {
  default:  ["#2f9160", "#1f6e46", "#123f27"],
  midnight: ["#2f5aa0", "#21407a", "#122a52"],
  velvet:   ["#8a3552", "#66253c", "#3f1626"],
  casino:   ["#a83a3a", "#7e2828", "#4d1616"],
  ocean:    ["#1f9a95", "#14726e", "#0a4442"],
};

/**
 * The casino table surface: a rounded-rectangular board with a wood-grain rail,
 * a padded leather inner rail, gold piping, and textured felt whose color
 * follows the player's equipped skin. The dealer, seats, cards and chips are
 * rendered on top of it.
 *
 * Fills a container whose aspect ratio matches the 1200x500 viewBox
 * (Tailwind `aspect-[12/5]`) via preserveAspectRatio="none".
 */
export function TableFelt({ className = "", skin }: TableFeltProps) {
  const [feltLight, feltMid, feltDark] =
    FELT_PALETTES[skin ?? "default"] ?? FELT_PALETTES.default;

  return (
    <svg
      viewBox="0 0 1200 500"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bjWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a6a3e" />
          <stop offset="0.5" stopColor="#5f3d20" />
          <stop offset="1" stopColor="#3a2410" />
        </linearGradient>
        <linearGradient id="bjRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33271b" />
          <stop offset="0.5" stopColor="#1d150d" />
          <stop offset="1" stopColor="#2c2016" />
        </linearGradient>
        <radialGradient id="bjFelt" cx="0.5" cy="0.44" r="0.85">
          <stop offset="0" stopColor={feltLight} />
          <stop offset="0.6" stopColor={feltMid} />
          <stop offset="1" stopColor={feltDark} />
        </radialGradient>

        {/* Wood grain — fine horizontal streaks overlaid on the wood rail */}
        <filter id="bjWoodGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.19" numOctaves="5" seed="9" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="m" />
          <feComponentTransfer in="m">
            <feFuncA type="linear" slope="0.22" />
          </feComponentTransfer>
        </filter>

        {/* Woven felt grain — desaturated fractal noise at low opacity */}
        <filter id="bjFeltNoise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7 0.9" numOctaves="2" seed="6" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="m" />
          <feComponentTransfer in="m">
            <feFuncA type="linear" slope="0.09" />
          </feComponentTransfer>
        </filter>

        <clipPath id="bjWoodClip">
          <rect x="6" y="6" width="1188" height="488" rx="32" />
        </clipPath>
        <clipPath id="bjFeltClip">
          <rect x="56" y="56" width="1088" height="388" rx="20" />
        </clipPath>

        {/* Downward-arched (concave) text baselines in the felt center: the middle
            dips away from the dealer's cards, the ends rise toward the sides, and
            the whole block sits high enough to clear the center player's name. */}
        <path id="bjArc1" d="M 345 163 Q 600 245 855 163" fill="none" />
        <path id="bjArc2" d="M 376 194 Q 600 268 824 194" fill="none" />
        <path id="bjArc3" d="M 408 222 Q 600 289 792 222" fill="none" />
      </defs>

      <rect x="6" y="6" width="1188" height="488" rx="32" fill="url(#bjWood)" />
      <rect
        x="6"
        y="6"
        width="1188"
        height="488"
        rx="32"
        clipPath="url(#bjWoodClip)"
        filter="url(#bjWoodGrain)"
      />
      <rect x="32" y="32" width="1136" height="436" rx="26" fill="url(#bjRail)" />
      <rect x="56" y="56" width="1088" height="388" rx="20" fill="url(#bjFelt)" />
      <rect
        x="56"
        y="56"
        width="1088"
        height="388"
        rx="20"
        clipPath="url(#bjFeltClip)"
        filter="url(#bjFeltNoise)"
      />
      <rect
        x="56"
        y="56"
        width="1088"
        height="388"
        rx="20"
        fill="none"
        stroke="#d8b25a"
        strokeWidth="2.5"
        strokeOpacity="0.8"
      />

      <g
        fill="#dbe5de"
        fillOpacity="0.13"
        fontFamily="sans-serif"
        fontWeight="600"
        style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
      >
        <text>
          <textPath href="#bjArc1" startOffset="50%" textAnchor="middle" fontSize="27" letterSpacing="5">
            BLACKJACK PAYS 3 TO 2
          </textPath>
        </text>
        <text fillOpacity="0.85">
          <textPath href="#bjArc2" startOffset="50%" textAnchor="middle" fontSize="19" letterSpacing="3">
            DEALER MUST HIT SOFT 17
          </textPath>
        </text>
        <text fillOpacity="0.7">
          <textPath href="#bjArc3" startOffset="50%" textAnchor="middle" fontSize="18" letterSpacing="3">
            INSURANCE PAYS 2 TO 1
          </textPath>
        </text>
      </g>
    </svg>
  );
}
