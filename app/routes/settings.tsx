import { useState } from "react";
import { Navigate } from "react-router";
import { DisplayName } from "~/components/ui/DisplayName";
import { Toggle } from "~/components/ui/Toggle";
import { ShellLayout } from "~/components/shell/ShellLayout";
import { useAuth } from "~/lib/AuthContext";
import { AVATAR_COLORS } from "~/lib/usePlayer";
import { useSoundSettings } from "~/lib/useSoundSettings";
import type { ChipSound } from "~/lib/soundManager";

/** Chip-click options, ordered brightest to most understated. */
const CHIP_SOUND_OPTIONS: { value: ChipSound; label: string; hint: string }[] = [
  { value: "clink", label: "Clink", hint: "Bright ceramic click" },
  { value: "stack", label: "Stack", hint: "Rounder, like chips settling" },
  { value: "tick", label: "Tick", hint: "Very short and dry" },
  { value: "classic", label: "Classic", hint: "The original sample" },
];

export function meta() {
  return [{ title: "Settings — Blackjack" }];
}

type Section = "profile" | "security" | "sound";

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "profile", label: "Profile", icon: "fa-user" },
  { key: "security", label: "Security", icon: "fa-lock" },
  { key: "sound", label: "Sound", icon: "fa-volume-high" },
];

/* Shared field styling — settings is form-heavy, so these keep the casino
   palette consistent without a class soup at every input. */
const FIELD =
  "w-full rounded-md bg-black/30 border border-[var(--brass)]/20 px-3 py-2 text-sm text-[#f0e4c6] placeholder:text-[#6b6144] focus:border-[var(--brass)]/55 focus:outline-none transition-colors";
const LABEL = "block text-[11px] uppercase tracking-[0.14em] text-[var(--parchment-dim)] mb-1.5";


export default function Settings() {
  const { user, token, updateUserProfile } = useAuth();
  const {
    muted: soundMuted,
    volume: soundVolume,
    tableSounds,
    chipSound,
    setMuted: setSoundMuted,
    setVolume: setSoundVolume,
    setTableSounds,
    setChipSound,
    preview: previewSound,
  } = useSoundSettings();

  const [section, setSection] = useState<Section>("profile");

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? AVATAR_COLORS[0]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Guard *after* every hook. Signing out from this page flips `user` to null,
  // and bailing out above the useState calls would change the hook count
  // between renders and crash React.
  if (!user) return <Navigate to="/login" replace />;

  const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);
  const previewLetter =
    displayName.trim().charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (changingPassword) {
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match");
        return;
      }
      if (newPassword.length < 12) {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        displayName?: string;
        avatarColor?: string;
        error?: string;
      };

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

  return (
    <ShellLayout contentClassName="px-4 py-8">
      <div className="w-full max-w-5xl mx-auto">
        <h1 className="font-display text-2xl text-[var(--parchment)] mb-5">Settings</h1>

        <div className="grid gap-7 md:grid-cols-[168px_1fr]">
          {/* ── Section rail ── */}
          <nav className="md:border-r md:border-[var(--brass)]/15 md:pr-4">
            <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
              {SECTIONS.map((s) => {
                const on = s.key === section;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded text-[12px] whitespace-nowrap transition-colors ${
                      on
                        ? "bg-white/[0.07] text-[var(--parchment)] shadow-[inset_2px_0_0_var(--brass)]"
                        : "text-[#9c8c66] hover:text-[#d5c398] hover:bg-white/[0.03]"
                    }`}
                  >
                    <i className={`fa-solid ${s.icon} text-[11px] opacity-80`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="max-w-md">
            {/* Profile and Security share one form and one save button, so a
                password change and a rename go up in a single request. */}
            {(section === "profile" || section === "security") && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {section === "profile" && (
                  <>
                    <div>
                      <p className="casino-eyebrow mb-3">Profile</p>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 border-2 border-[var(--brass)]/45"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {previewLetter}
                        </div>
                        <div>
                          {displayName.trim() ? (
                            <DisplayName
                              displayName={displayName.trim()}
                              nameEffect={user.equippedNameEffect}
                              className="font-display text-[15px] text-[#eddfbe]"
                            />
                          ) : (
                            <span className="text-[#6b6144] text-sm">Display name</span>
                          )}
                          <p className="text-[11px] text-[#7d6f4d]">@{user.username}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="display-name" className={LABEL}>
                        Display name
                      </label>
                      <input
                        id="display-name"
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          setSuccess(false);
                        }}
                        placeholder="How others see you in game"
                        maxLength={50}
                        className={FIELD}
                      />
                    </div>

                    <div>
                      <span className={LABEL}>Avatar colour</span>
                      <div className="flex gap-2 flex-wrap">
                        {AVATAR_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setAvatarColor(color);
                              setSuccess(false);
                            }}
                            aria-label={`Avatar colour ${color}`}
                            className={`w-8 h-8 rounded-full transition-all duration-150 ${
                              avatarColor === color
                                ? "ring-2 ring-[var(--brass)] ring-offset-2 ring-offset-[#0c2b1c] scale-110"
                                : "hover:scale-105"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {section === "security" && (
                  <>
                    <div>
                      <p className="casino-eyebrow mb-1">Change password</p>
                      <p className="text-[11px] text-[#7d6f4d]">
                        Leave blank to keep your current password.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="current-password" className={LABEL}>
                        Current password
                      </label>
                      <input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setSuccess(false);
                          setError("");
                        }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className={LABEL}>
                        New password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setSuccess(false);
                          setError("");
                        }}
                        placeholder="At least 12 characters"
                        autoComplete="new-password"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className={LABEL}>
                        Confirm new password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setSuccess(false);
                          setError("");
                        }}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className={FIELD}
                      />
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-red-300">{error}</p>}
                {success && <p className="text-sm text-emerald-300">Saved.</p>}

                <button
                  type="submit"
                  disabled={loading || !displayName.trim()}
                  className="btn-brass rounded-md py-2.5 text-[12px] font-extrabold uppercase tracking-[0.09em] transition-all disabled:opacity-40"
                >
                  {loading ? "Saving…" : "Save changes"}
                </button>
              </form>
            )}

            {section === "sound" && (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="casino-eyebrow mb-1">Sound</p>
                  <p className="text-[11px] text-[#7d6f4d]">
                    Saved on this device and applied immediately.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[#d5c398]">Mute all sound</span>
                  <Toggle
                    label="Mute all sound"
                    checked={soundMuted}
                    onChange={setSoundMuted}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm ${soundMuted ? "text-[#6b6144]" : "text-[#d5c398]"}`}>
                      Volume
                    </span>
                    <span className="text-[11px] tabular-nums text-[var(--parchment-dim)]">
                      {Math.round(soundVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={soundVolume}
                    disabled={soundMuted}
                    onChange={(e) => setSoundVolume(Number(e.target.value))}
                    onMouseUp={previewSound}
                    onTouchEnd={previewSound}
                    className="w-full accent-[var(--brass)] disabled:opacity-40 cursor-pointer"
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span>
                    <span className={`text-sm ${soundMuted ? "text-[#6b6144]" : "text-[#d5c398]"}`}>
                      Table sounds
                    </span>
                    <span className="block text-[11px] text-[#7d6f4d] mt-0.5">
                      Hear other players hit, stand, double and hit blackjack. Turn off to
                      only hear your own seat.
                    </span>
                  </span>
                  <span className="mt-0.5">
                    <Toggle
                      label="Table sounds"
                      checked={tableSounds}
                      disabled={soundMuted}
                      onChange={setTableSounds}
                    />
                  </span>
                </div>

                <div>
                  <span className={`text-sm ${soundMuted ? "text-[#6b6144]" : "text-[#d5c398]"}`}>
                    Chip sound
                  </span>
                  <span className="block text-[11px] text-[#7d6f4d] mt-0.5 mb-2">
                    Plays every time you add to a bet. Click one to hear it.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CHIP_SOUND_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={soundMuted}
                        onClick={() => setChipSound(opt.value)}
                        title={opt.hint}
                        className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          chipSound === opt.value
                            ? "bg-[var(--brass)] text-[#20160a]"
                            : "bg-white/[0.06] text-[#c2ad80] hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </ShellLayout>
  );
}
