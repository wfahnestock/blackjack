// ─── Card Skin Catalog ────────────────────────────────────────────────────────
//
// Each entry defines a purchasable vanity item that controls the visual style
// of a player's cards (both face and back).  The `key` maps to CSS classes
// `cs-face-{key}` (applied to face cards) and `cs-back-{key}` (applied to the
// card back).  "default" is always owned for free and produces the classic
// white/blue styling.

export interface CardSkinDef {
  key: string;
  label: string;
  description: string;
  /** Chip cost.  0 = free / always owned. */
  cost: number;
  /**
   * When set, this skin is role-locked: it is never purchasable and is only
   * equippable by players who hold the named role.
   */
  requiredRole?: string;
}

export const CARD_SKINS: CardSkinDef[] = [
  {
    key:         "default",
    label:       "Default",
    description: "Classic white card",
    cost:        0,
  },
  {
    key:         "gold",
    label:       "Gold",
    description: "Gilded deck with a warm golden finish",
    cost:        50_000,
  },
  {
    key:         "midnight",
    label:       "Midnight",
    description: "Deep navy cards with silver accents",
    cost:        5_000,
  },
  {
    key:         "rose",
    label:       "Rose",
    description: "Soft rose and blush tones",
    cost:        3_000,
  },
  {
    key:         "neon",
    label:       "Neon",
    description: "Electric cyan glow on dark slate",
    cost:        8_000,
  },
  {
    key:         "obsidian",
    label:       "Obsidian",
    description: "Polished volcanic glass — deep black with subtle edge reflections",
    cost:        10_000,
  },
];

/** Set of all valid skin keys, for server-side validation. */
export const CARD_SKIN_KEYS = new Set(CARD_SKINS.map((s) => s.key));

/** Returns the CSS class for the card face, or "" for default. */
export function cardSkinFaceClass(key: string | null | undefined): string {
  if (!key || key === "default") return "";
  return `cs-face-${key}`;
}

/** Returns the CSS class for the card back, or "" for default. */
export function cardSkinBackClass(key: string | null | undefined): string {
  if (!key || key === "default") return "";
  return `cs-back-${key}`;
}
