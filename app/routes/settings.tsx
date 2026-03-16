import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DisplayName } from "~/components/ui/DisplayName";
import { useAuth } from "~/lib/AuthContext";
import { AVATAR_COLORS } from "~/lib/usePlayer";
import { NAME_EFFECTS, nameEffectClass, type NameEffectDef } from "~/lib/nameEffects";

export function meta() {
  return [{ title: "Account Settings — Blackjack" }];
}

// ─── Name-effect shop state ───────────────────────────────────────────────────

interface VanityState {
  owned: string[];       // effect keys the player owns (never includes "default")
  equipped: string | null;
  loading: boolean;
  actionLoading: string | null; // effectKey currently being bought or equipped
  error: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, token, updateUserProfile, updateEquippedEffect, updateUserChips } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // ─── Profile form ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName]       = useState(user.displayName);
  const [avatarColor, setAvatarColor]       = useState(user.avatarColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [success, setSuccess]               = useState(false);

  // ─── Vanity shop ───────────────────────────────────────────────────────────
  const [vanity, setVanity] = useState<VanityState>({
    owned:         [],
    equipped:      user.equippedNameEffect ?? null,
    loading:       true,
    actionLoading: null,
    error:         "",
  });

  useEffect(() => {
    fetch("/api/vanity/name-effects", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { owned: string[]; equipped: string | null }) => {
        setVanity((v) => ({ ...v, owned: data.owned, equipped: data.equipped, loading: false }));
      })
      .catch(() => {
        setVanity((v) => ({ ...v, loading: false, error: "Couldn't load name effects" }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userRoles = user?.roles ?? [];

  /** Effects visible to this player (role-locked ones only shown if user qualifies). */
  const visibleEffects = NAME_EFFECTS.filter((effect) => {
    if (!effect.requiredRole) return true;
    return userRoles.some((r) => r.name === effect.requiredRole);
  });

  function ownsEffect(key: string): boolean {
    const effect = NAME_EFFECTS.find((e) => e.key === key);
    // Role-locked effects are always "owned" for players who have the required role
    if (effect?.requiredRole) {
      return userRoles.some((r) => r.name === effect.requiredRole);
    }
    return key === "default" || vanity.owned.includes(key);
  }

  async function handlePurchase(effect: NameEffectDef) {
    if (vanity.actionLoading) return;
    setVanity((v) => ({ ...v, actionLoading: effect.key, error: "" }));
    try {
      const res = await fetch("/api/vanity/name-effects/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ effectKey: effect.key }),
      });
      const data = (await res.json()) as { chips?: number; error?: string };
      if (!res.ok) {
        setVanity((v) => ({ ...v, actionLoading: null, error: data.error ?? "Purchase failed" }));
        return;
      }
      setVanity((v) => ({ ...v, owned: [...v.owned, effect.key], actionLoading: null }));
      if (data.chips != null) updateUserChips(data.chips);
    } catch {
      setVanity((v) => ({ ...v, actionLoading: null, error: "Network error" }));
    }
  }

  async function handleEquip(effectKey: string | null) {
    if (vanity.actionLoading) return;
    const key = effectKey === "default" ? null : effectKey;
    setVanity((v) => ({ ...v, actionLoading: effectKey ?? "default", error: "" }));
    try {
      const res = await fetch("/api/vanity/name-effects/equip", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ effectKey: key }),
      });
      const data = (await res.json()) as { effectKey: string | null; error?: string };
      if (!res.ok) {
        setVanity((v) => ({ ...v, actionLoading: null, error: data.error ?? "Equip failed" }));
        return;
      }
      setVanity((v) => ({ ...v, equipped: data.effectKey, actionLoading: null }));
      updateEquippedEffect(data.effectKey);
    } catch {
      setVanity((v) => ({ ...v, actionLoading: null, error: "Network error" }));
    }
  }

  // ─── Profile form submit ───────────────────────────────────────────────────
  const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (changingPassword) {
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 12 characters");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const body: Record<string, string> = { displayName, avatarColor };
      if (changingPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch(`/api/players/${user.playerId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { displayName?: string; avatarColor?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
        return;
      }

      updateUserProfile(data.displayName!, data.avatarColor!);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const previewLetter = displayName.trim().charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <div className="text-6xl mb-3 select-none">♠</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Settings</h1>
          <p className="text-gray-500 mt-2">Manage your account</p>
        </div>

        {/* ── Profile form ── */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5"
        >
          {/* Profile section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile</h2>

            {/* Live preview */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 transition-colors"
                style={{ backgroundColor: avatarColor }}
              >
                {previewLetter}
              </div>
              <div>
                <p className="font-semibold leading-tight">
                  {displayName.trim() ? (
                    <DisplayName
                      displayName={displayName.trim()}
                      nameEffect={vanity.equipped}
                      className="text-white"
                    />
                  ) : (
                    <span className="text-gray-600">Display name</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">@{user.username}</p>
              </div>
            </div>

            <Input
              label="Display Name"
              id="display-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSuccess(false);
              }}
              placeholder="How others see you in game"
              maxLength={50}
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-300">Avatar Color</span>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setAvatarColor(color);
                      setSuccess(false);
                    }}
                    className={`w-8 h-8 rounded-full transition-all duration-150 ${
                      avatarColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* Password section */}
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Password</h2>
              <p className="text-xs text-gray-600 mt-1">Leave blank to keep your current password</p>
            </div>

            <Input
              label="Current Password"
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setSuccess(false); setError(""); }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <Input
              label="New Password"
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setSuccess(false); setError(""); }}
              placeholder="At least 12 characters"
              autoComplete="new-password"
            />
            <Input
              label="Confirm New Password"
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setSuccess(false); setError(""); }}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error   && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">Settings saved successfully.</p>}

          <Button variant="primary" size="lg" type="submit" disabled={loading || !displayName.trim()}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>

          <Button variant="ghost" size="md" type="button" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </form>

        {/* ── Name Effects shop ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name Effects</h2>
            <p className="text-xs text-gray-600 mt-1">
              Purchase effects with chips to change how your name looks everywhere in game.
            </p>
          </div>

          {vanity.error && <p className="text-sm text-red-400">{vanity.error}</p>}

          {vanity.loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleEffects.map((effect) => {
                const owned    = ownsEffect(effect.key);
                const equipped = vanity.equipped === effect.key
                               || (effect.key === "default" && !vanity.equipped);
                const isActing = vanity.actionLoading === effect.key;

                return (
                  <div
                    key={effect.key}
                    className={`
                      flex flex-col gap-2 p-3 rounded-xl border transition-colors
                      ${equipped
                        ? "border-emerald-500/50 bg-emerald-950/30"
                        : "border-gray-700/60 bg-gray-800/40"}
                    `}
                  >
                    {/* Effect name preview */}
                    <p
                      className={`text-sm font-bold truncate ${nameEffectClass(effect.key) || "text-white"}`}
                      style={nameEffectClass(effect.key) ? { overflow: "clip", overflowClipMargin: "30px" } : undefined}
                    >
                      {effect.label}
                    </p>

                    {/* Cost or status */}
                    <p className="text-xs text-gray-500 leading-tight">{effect.description}</p>

                    {equipped ? (
                      <span className="text-xs font-semibold text-emerald-400">✓ Equipped</span>
                    ) : owned ? (
                      <button
                        onClick={() => handleEquip(effect.key)}
                        disabled={!!vanity.actionLoading}
                        className="text-xs font-semibold text-gray-300 hover:text-white transition-colors disabled:opacity-50 text-left"
                      >
                        {isActing ? "Equipping…" : "Equip"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePurchase(effect)}
                        disabled={!!vanity.actionLoading || user.chips < effect.cost}
                        className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50 text-left"
                      >
                        {isActing
                          ? "Buying…"
                          : `${effect.cost.toLocaleString()} chips`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Unequip button — only shown when something non-default is equipped */}
          {vanity.equipped && (
            <button
              onClick={() => handleEquip(null)}
              disabled={!!vanity.actionLoading}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors self-center disabled:opacity-50"
            >
              {vanity.actionLoading === null && vanity.equipped ? "Remove effect" : "Removing…"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
