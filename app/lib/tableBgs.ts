// ─── Table Background Catalog ─────────────────────────────────────────────────
//
// Each entry defines a purchasable vanity item that controls the table felt
// background.  Table backgrounds are LOCAL-ONLY — only the equipping player
// sees their own background; other players are unaffected.
//
// The `key` maps to either the special value "default" (which resolves to the
// existing `felt-bg` class) or to a CSS class `tb-{key}` defined in app.css.

export interface TableBgDef {
  key: string;
  label: string;
  description: string;
  /** Chip cost.  0 = free / always owned. */
  cost: number;
  requiredRole?: string;
}

export const TABLE_BGS: TableBgDef[] = [
  {
    key:         "default",
    label:       "Felt Green",
    description: "Classic casino green felt",
    cost:        0,
  },
  {
    key:         "midnight",
    label:       "Midnight",
    description: "Deep navy blue felt",
    cost:        5_000,
  },
  {
    key:         "velvet",
    label:       "Velvet",
    description: "Rich burgundy velvet",
    cost:        5_000,
  },
  {
    key:         "casino",
    label:       "Casino Red",
    description: "Classic Vegas red felt",
    cost:        7_000,
  },
  {
    key:         "ocean",
    label:       "Ocean",
    description: "Cool deep-sea teal",
    cost:        7_000,
  },
];

/** Set of all valid background keys, for server-side validation. */
export const TABLE_BG_KEYS = new Set(TABLE_BGS.map((b) => b.key));

/**
 * Returns the CSS class for the given table background key.
 * "default" (or null/undefined) resolves to the built-in `felt-bg` class.
 */
export function tableBgClass(key: string | null | undefined): string {
  if (!key || key === "default") return "felt-bg";
  return `tb-${key}`;
}
