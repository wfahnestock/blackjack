import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { useAuth } from "~/lib/AuthContext";
import { AVATAR_COLORS } from "~/lib/usePlayer";

export function meta() {
  return [{ title: "Create Account — Blackjack" }];
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[1]); // default emerald
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await register(username.trim(), displayName.trim(), avatarColor, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <div className="text-6xl mb-3 select-none">♠</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Blackjack</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4"
        >
          <Input
            label="Username"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="your_username"
            autoComplete="username"
            autoFocus
            maxLength={32}
          />
          <p className="text-xs text-gray-600 -mt-2">Letters, numbers, and underscores only</p>

          <Input
            label="Display Name"
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
                  onClick={() => setAvatarColor(color)}
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

          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <Input
            label="Confirm Password"
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={
              loading ||
              !username.trim() ||
              !displayName.trim() ||
              !password ||
              !confirmPassword
            }
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
