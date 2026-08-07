import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { useAuth } from "~/lib/AuthContext";

export function meta() {
  return [{ title: "Login — Blackjack" }];
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="casino-felt min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <div className="mb-1 select-none text-4xl text-[var(--brass)]">♠</div>
          <h1 className="font-display text-4xl text-[var(--parchment)]">Blackjack</h1>
          <p className="casino-eyebrow mt-2">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="casino-panel flex flex-col gap-4 p-6"
        >
          <Input
            label="Username"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="username"
            autoFocus
          />
          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && <p className="text-[12px] text-red-300">{error}</p>}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>

          <p className="text-center text-[12px] text-[var(--parchment-dim)]">
            No account?{" "}
            <Link
              to="/register"
              className="text-[#e8cd7a] underline-offset-2 transition-colors hover:text-[#f5e2a6] hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
