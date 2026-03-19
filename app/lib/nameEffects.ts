// ─── Name Effect Catalog ──────────────────────────────────────────────────────
//
// Each entry defines a purchasable vanity item that controls both the color
// and animation of a player's display name.  The `key` maps directly to the
// CSS class  `ne-{key}` defined in app.css.  "default" is always owned for
// free and produces plain white text with no animation.

export interface NameEffectDef {
  key: string;
  label: string;
  description: string;
  /** Chip cost.  0 = free / always owned. */
  cost: number;
  /**
   * When set, this effect is role-locked: it is never purchasable and is only
   * visible to / equippable by players who hold the named role.
   */
  requiredRole?: string;
}

export const NAME_EFFECTS: NameEffectDef[] = [
  {
    key:         "default",
    label:       "Default",
    description: "Standard white text",
    cost:        0,
  },
  {
    key:         "gold",
    label:       "Gold",
    description: "Shimmering golden gradient",
    cost:        5_000,
  },
  {
    key:         "fire",
    label:       "Fire",
    description: "Blazing red and orange",
    cost:        8_000,
  },
  {
    key:         "ocean",
    label:       "Ocean",
    description: "Cool flowing blue and teal",
    cost:        8_000,
  },
  {
    key:         "neon",
    label:       "Neon",
    description: "Glowing cyan pulse",
    cost:        10_000,
  },
  {
    key:         "galaxy",
    label:       "Galaxy",
    description: "Purple and pink cosmos",
    cost:        12_000,
  },
  {
    key:         "rainbow",
    label:       "Rainbow",
    description: "Full-spectrum color cycle",
    cost:        15_000,
  },
  {
    key:         "lightning",
    label:       "Lightning",
    description: "Electric arcs flashing across dim, sharp text",
    cost:        15_000,
  },
  {
    key:          "glitch",
    label:        "Glitch",
    description:  "Developer-exclusive glitch effect",
    cost:         0,
    requiredRole: "developer",
  },
];

/** Set of all valid effect keys, for server-side validation. */
export const NAME_EFFECT_KEYS = new Set(NAME_EFFECTS.map((e) => e.key));

/** Returns the CSS class that renders a given effect key, or "" for default. */
export function nameEffectClass(key: string | null | undefined): string {
  if (!key || key === "default") return "";
  return `ne-${key}`;
}
