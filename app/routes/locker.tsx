import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "~/lib/AuthContext";
import { ShellLayout } from "~/components/shell/ShellLayout";
import { DisplayName } from "~/components/ui/DisplayName";
import { PlayingCard } from "~/components/game/PlayingCard";
import { NAME_EFFECTS, nameEffectClass, type NameEffectDef } from "~/lib/nameEffects";
import { CARD_SKINS, cardSkinFaceClass, cardSkinBackClass, type CardSkinDef } from "~/lib/cardSkins";
import { TABLE_BGS, tableBgClass, type TableBgDef } from "~/lib/tableBgs";
import { formatChips } from "~/lib/handUtils";

export function meta() {
  return [{ title: "Locker — Blackjack" }];
}

type Category = "card-skins" | "table-felts" | "name-effects";

const CATEGORIES: { key: Category; label: string; icon: string; blurb: string }[] = [
  {
    key: "card-skins",
    label: "Card Skins",
    icon: "fa-clone",
    blurb: "Everyone at your table sees these.",
  },
  {
    key: "table-felts",
    label: "Table Felts",
    icon: "fa-table",
    blurb: "Only you see your felt — at the table and across the site.",
  },
  {
    key: "name-effects",
    label: "Name Effects",
    icon: "fa-wand-magic-sparkles",
    blurb: "Changes how your name looks everywhere in game.",
  },
];

/** Shared shape for the three vanity shops. */
interface ShopState {
  owned: string[];
  equipped: string | null;
  loading: boolean;
  actionLoading: string | null;
  error: string;
}

const emptyShop = (equipped: string | null): ShopState => ({
  owned: [],
  equipped,
  loading: true,
  actionLoading: null,
  error: "",
});

export default function Locker() {
  const {
    user,
    token,
    updateUserChips,
    updateEquippedEffect,
    updateEquippedCardSkin,
    updateEquippedTableBg,
  } = useAuth();

  const [category, setCategory] = useState<Category>("card-skins");

  const [cardSkins, setCardSkins] = useState<ShopState>(emptyShop(user?.equippedCardSkin ?? null));
  const [tableBgs, setTableBgs] = useState<ShopState>(emptyShop(user?.equippedTableBg ?? null));
  const [effects, setEffects] = useState<ShopState>(emptyShop(user?.equippedNameEffect ?? null));

  // Each shop loads its own owned/equipped list.
  useEffect(() => {
    const load = (
      url: string,
      set: React.Dispatch<React.SetStateAction<ShopState>>,
      failure: string
    ) => {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { owned: string[]; equipped: string | null }) =>
          set((s) => ({ ...s, owned: data.owned, equipped: data.equipped, loading: false }))
        )
        .catch(() => set((s) => ({ ...s, loading: false, error: failure })));
    };

    load("/api/vanity/card-skins", setCardSkins, "Couldn't load card skins");
    load("/api/vanity/table-bgs", setTableBgs, "Couldn't load table felts");
    load("/api/vanity/name-effects", setEffects, "Couldn't load name effects");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard *after* every hook — signing out flips `user` to null, and returning
  // above the hooks would change the hook count between renders.
  if (!user) return <Navigate to="/login" replace />;

  const userRoles = user.roles ?? [];

  /** Role-locked items are hidden unless the player holds the role. */
  const visibleEffects = NAME_EFFECTS.filter(
    (e) => !e.requiredRole || userRoles.some((r) => r.name === e.requiredRole)
  );

  function owns(state: ShopState, key: string, requiredRole?: string): boolean {
    // A role grants the item outright — there's nothing to buy.
    if (requiredRole) return userRoles.some((r) => r.name === requiredRole);
    return key === "default" || state.owned.includes(key);
  }

  async function purchase(
    set: React.Dispatch<React.SetStateAction<ShopState>>,
    endpoint: string,
    body: Record<string, string>,
    key: string
  ) {
    set((s) => ({ ...s, actionLoading: key, error: "" }));
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { chips?: number; error?: string };
      if (!res.ok) {
        set((s) => ({ ...s, actionLoading: null, error: data.error ?? "Purchase failed" }));
        return;
      }
      set((s) => ({ ...s, owned: [...s.owned, key], actionLoading: null }));
      if (data.chips != null) updateUserChips(data.chips);
    } catch {
      set((s) => ({ ...s, actionLoading: null, error: "Network error" }));
    }
  }

  async function equip(
    set: React.Dispatch<React.SetStateAction<ShopState>>,
    endpoint: string,
    field: "skinKey" | "effectKey",
    key: string,
    onSuccess: (k: string | null) => void
  ) {
    const value = key === "default" ? null : key;
    set((s) => ({ ...s, actionLoading: key, error: "" }));
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      });
      const data = (await res.json()) as Record<string, any>;
      if (!res.ok) {
        set((s) => ({ ...s, actionLoading: null, error: data.error ?? "Equip failed" }));
        return;
      }
      const next = data[field] ?? null;
      set((s) => ({ ...s, equipped: next, actionLoading: null }));
      onSuccess(next);
    } catch {
      set((s) => ({ ...s, actionLoading: null, error: "Network error" }));
    }
  }

  const active = CATEGORIES.find((c) => c.key === category)!;
  const activeShop =
    category === "card-skins" ? cardSkins : category === "table-felts" ? tableBgs : effects;

  return (
    <ShellLayout contentClassName="px-4 py-8">
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="font-display text-2xl text-[var(--parchment)]">Locker</h1>
          <p className="text-[11px] text-[var(--parchment-dim)]">
            <span className="tabular-nums text-[#f4d780] font-semibold">
              {formatChips(user.chips)}
            </span>{" "}
            chips available
          </p>
        </div>

        <div className="grid gap-7 md:grid-cols-[168px_1fr]">
          {/* ── Category rail ── */}
          <nav className="md:border-r md:border-[var(--brass)]/15 md:pr-4">
            <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((c) => {
                const on = c.key === category;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded text-[12px] whitespace-nowrap transition-colors ${
                      on
                        ? "bg-white/[0.07] text-[var(--parchment)] shadow-[inset_2px_0_0_var(--brass)]"
                        : "text-[#9c8c66] hover:text-[#d5c398] hover:bg-white/[0.03]"
                    }`}
                  >
                    <i className={`fa-solid ${c.icon} text-[11px] opacity-80`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ── Item grid ── */}
          <section>
            <p className="casino-eyebrow mb-1">{active.label}</p>
            <p className="text-[11px] text-[#7d6f4d] mb-4">{active.blurb}</p>

            {activeShop.error && (
              <p className="mb-3 text-[12px] text-red-300">{activeShop.error}</p>
            )}

            {activeShop.loading ? (
              <p className="text-[11px] text-[#6b6144] py-6">Opening your locker…</p>
            ) : category === "card-skins" ? (
              <Grid>
                {CARD_SKINS.map((skin) => (
                  <ItemTile
                    key={skin.key}
                    label={skin.label}
                    description={skin.description}
                    cost={skin.cost}
                    owned={owns(cardSkins, skin.key, skin.requiredRole)}
                    equipped={(cardSkins.equipped ?? "default") === skin.key}
                    busy={cardSkins.actionLoading === skin.key}
                    disabled={!!cardSkins.actionLoading}
                    affordable={user.chips >= skin.cost}
                    roleLocked={skin.requiredRole}
                    preview={
                      <div className="flex gap-1.5 justify-center scale-[0.62] origin-center">
                        <PlayingCard card={{ rank: "A", suit: "spades", faceDown: false }} skin={skin.key} />
                        <PlayingCard card={{ rank: "2", suit: "spades", faceDown: true }} skin={skin.key} />
                      </div>
                    }
                    onBuy={() =>
                      purchase(
                        setCardSkins,
                        "/api/vanity/card-skins/purchase",
                        { skinKey: skin.key },
                        skin.key
                      )
                    }
                    onEquip={() =>
                      equip(
                        setCardSkins,
                        "/api/vanity/card-skins/equip",
                        "skinKey",
                        skin.key,
                        updateEquippedCardSkin
                      )
                    }
                  />
                ))}
              </Grid>
            ) : category === "table-felts" ? (
              <Grid>
                {TABLE_BGS.map((bg) => (
                  <ItemTile
                    key={bg.key}
                    label={bg.label}
                    description={bg.description}
                    cost={bg.cost}
                    owned={owns(tableBgs, bg.key, bg.requiredRole)}
                    equipped={(tableBgs.equipped ?? "default") === bg.key}
                    busy={tableBgs.actionLoading === bg.key}
                    disabled={!!tableBgs.actionLoading}
                    affordable={user.chips >= bg.cost}
                    roleLocked={bg.requiredRole}
                    preview={
                      <div
                        className={`${tableBgClass(bg.key)} w-full h-full rounded`}
                        aria-hidden
                      />
                    }
                    onBuy={() =>
                      purchase(
                        setTableBgs,
                        "/api/vanity/table-bgs/purchase",
                        { skinKey: bg.key },
                        bg.key
                      )
                    }
                    onEquip={() =>
                      equip(
                        setTableBgs,
                        "/api/vanity/table-bgs/equip",
                        "skinKey",
                        bg.key,
                        updateEquippedTableBg
                      )
                    }
                  />
                ))}
              </Grid>
            ) : (
              <Grid>
                {visibleEffects.map((effect) => (
                  <ItemTile
                    key={effect.key}
                    label={effect.label}
                    description={effect.description}
                    cost={effect.cost}
                    owned={owns(effects, effect.key, effect.requiredRole)}
                    equipped={(effects.equipped ?? "default") === effect.key}
                    busy={effects.actionLoading === effect.key}
                    disabled={!!effects.actionLoading}
                    affordable={user.chips >= effect.cost}
                    roleLocked={effect.requiredRole}
                    preview={
                      <span
                        className={`font-semibold text-[15px] ${nameEffectClass(effect.key)}`}
                      >
                        {user.displayName}
                      </span>
                    }
                    onBuy={() =>
                      purchase(
                        setEffects,
                        "/api/vanity/name-effects/purchase",
                        { effectKey: effect.key },
                        effect.key
                      )
                    }
                    onEquip={() =>
                      equip(
                        setEffects,
                        "/api/vanity/name-effects/equip",
                        "effectKey",
                        effect.key,
                        updateEquippedEffect
                      )
                    }
                  />
                ))}
              </Grid>
            )}
          </section>
        </div>
      </div>
    </ShellLayout>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/**
 * One purchasable/equippable item. Deliberately uniform across categories so a
 * new category is a config entry plus a preview renderer, not a new layout.
 */
function ItemTile({
  label,
  description,
  cost,
  owned,
  equipped,
  busy,
  disabled,
  affordable,
  roleLocked,
  preview,
  onBuy,
  onEquip,
}: {
  label: string;
  description: string;
  cost: number;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  disabled: boolean;
  affordable: boolean;
  roleLocked?: string;
  preview: React.ReactNode;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2.5 transition-colors ${
        equipped
          ? "border-[var(--brass)]/70 bg-[var(--brass)]/[0.07]"
          : "border-white/10 bg-black/20 hover:border-white/20"
      }`}
    >
      <div className="h-[68px] rounded bg-black/30 border border-white/5 flex items-center justify-center overflow-hidden">
        {preview}
      </div>

      <div className="min-h-[34px]">
        <p className="font-display text-[13px] text-[#eddfbe] leading-tight">{label}</p>
        <p className="text-[10.5px] text-[#7d6f4d] leading-snug line-clamp-2">{description}</p>
      </div>

      {equipped ? (
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--brass)] py-1.5 text-center">
          <i className="fa-solid fa-check mr-1.5" />
          Equipped
        </span>
      ) : owned ? (
        <button
          onClick={onEquip}
          disabled={disabled}
          className="btn-brass-ghost rounded py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-40"
        >
          {busy ? "…" : "Equip"}
        </button>
      ) : roleLocked ? (
        <span className="text-[10px] uppercase tracking-[0.1em] text-[#7d6f4d] py-1.5 text-center">
          {roleLocked} only
        </span>
      ) : (
        <button
          onClick={onBuy}
          disabled={disabled || !affordable}
          title={affordable ? undefined : "Not enough chips"}
          className="btn-brass rounded py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "…" : formatChips(cost)}
        </button>
      )}
    </div>
  );
}
