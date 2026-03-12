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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <div className="text-6xl mb-3 select-none">♠</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Blackjack</h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4"
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-center text-sm text-gray-500">
            No account?{" "}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
