import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { RoleInfo } from "~/lib/types";

export interface AuthUser {
  playerId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  chips: number;
  lastDailyClaimed: string | null;
  roles: RoleInfo[];
  equippedNameEffect: string | null;
  /** Equipped card skin key — visible to all players at the table. */
  equippedCardSkin: string | null;
  /** Equipped table background key — local-only, never broadcast to other players. */
  equippedTableBg: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    displayName: string,
    avatarColor: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  /** Update local chip/reward state after a daily claim or round end. */
  updateUserChips: (chips: number, lastDailyClaimed?: string | null) => void;
  /** Update local profile state after settings are saved. */
  updateUserProfile: (displayName: string, avatarColor: string) => void;
  /** Update local equipped name-effect state after equipping/unequipping a vanity item. */
  updateEquippedEffect: (effectKey: string | null) => void;
  /** Update local equipped card skin state after equipping/unequipping. */
  updateEquippedCardSkin: (skinKey: string | null) => void;
  /** Update local equipped table background state after equipping/unequipping. */
  updateEquippedTableBg: (bgKey: string | null) => void;
}

const AUTH_TOKEN_KEY = "bj_auth_token";
const AUTH_PLAYER_KEY = "bj_auth_player";

const AuthContext = createContext<AuthContextValue | null>(null);

interface ServerPlayerResponse {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  chips: number;
  lastDailyClaimed: string | null;
  roles: RoleInfo[];
  equippedNameEffect?: string | null;
  equippedCardSkin?: string | null;
  equippedTableBg?: string | null;
}

interface AuthApiResponse {
  token: string;
  player: ServerPlayerResponse;
}

async function apiFetch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
}

function serverPlayerToAuthUser(player: ServerPlayerResponse): AuthUser {
  return {
    playerId: player.id,
    username: player.username,
    displayName: player.displayName,
    avatarColor: player.avatarColor,
    chips: player.chips,
    lastDailyClaimed: player.lastDailyClaimed,
    roles: player.roles ?? [],
    equippedNameEffect: player.equippedNameEffect ?? null,
    equippedCardSkin:   player.equippedCardSkin   ?? null,
    equippedTableBg:    player.equippedTableBg    ?? null,
  };
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate old localStorage entries that stored a single `role` string
    if (!parsed.roles) parsed.roles = [];
    // Migrate old entries without equippedNameEffect
    if (!("equippedNameEffect" in parsed)) parsed.equippedNameEffect = null;
    // Migrate old entries without skin fields
    if (!("equippedCardSkin" in parsed)) parsed.equippedCardSkin = null;
    if (!("equippedTableBg"  in parsed)) parsed.equippedTableBg  = null;
    return parsed as unknown as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(AUTH_TOKEN_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);

  function storeSession(newToken: string, newUser: AuthUser) {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  async function login(username: string, password: string): Promise<void> {
    const data = await apiFetch<AuthApiResponse>("/api/auth/login", { username, password });
    storeSession(data.token, serverPlayerToAuthUser(data.player));
  }

  async function register(
    username: string,
    displayName: string,
    avatarColor: string,
    password: string
  ): Promise<void> {
    const data = await apiFetch<AuthApiResponse>("/api/auth/register", {
      username,
      displayName,
      avatarColor,
      password,
    });
    storeSession(data.token, serverPlayerToAuthUser(data.player));
  }

  function logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_PLAYER_KEY);
    setToken(null);
    setUser(null);
  }

  function updateUserChips(chips: number, lastDailyClaimed?: string | null): void {
    if (!user) return;
    const updated: AuthUser = {
      ...user,
      chips,
      lastDailyClaimed: lastDailyClaimed !== undefined ? lastDailyClaimed : user.lastDailyClaimed,
    };
    setUser(updated);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(updated));
  }

  function updateUserProfile(displayName: string, avatarColor: string): void {
    if (!user) return;
    const updated: AuthUser = { ...user, displayName, avatarColor };
    setUser(updated);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(updated));
  }

  function updateEquippedEffect(effectKey: string | null): void {
    if (!user) return;
    const updated: AuthUser = { ...user, equippedNameEffect: effectKey };
    setUser(updated);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(updated));
  }

  function updateEquippedCardSkin(skinKey: string | null): void {
    if (!user) return;
    const updated: AuthUser = { ...user, equippedCardSkin: skinKey };
    setUser(updated);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(updated));
  }

  function updateEquippedTableBg(bgKey: string | null): void {
    if (!user) return;
    const updated: AuthUser = { ...user, equippedTableBg: bgKey };
    setUser(updated);
    localStorage.setItem(AUTH_PLAYER_KEY, JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUserChips, updateUserProfile, updateEquippedEffect, updateEquippedCardSkin, updateEquippedTableBg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
