import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { useAuth } from "~/lib/AuthContext";
import { AVATAR_COLORS } from "~/lib/usePlayer";

export function meta() {
  return [{ title: "Account Settings — Blackjack" }];
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, token, updateUserProfile } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
                <p className="font-semibold text-white leading-tight">
                  {displayName.trim() || <span className="text-gray-600">Display name</span>}
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
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setSuccess(false);
                setError("");
              }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <Input
              label="New Password"
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
            />
            <Input
              label="Confirm New Password"
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
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">Settings saved successfully.</p>}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={loading || !displayName.trim()}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>

          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={() => navigate("/")}
          >
            Back to Home
          </Button>
        </form>
      </div>
    </div>
  );
}
