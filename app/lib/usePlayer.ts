import { useAuth } from "./AuthContext.js";

export const AVATAR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export interface PlayerInfo {
  playerId: string;
  displayName: string;
  avatarColor: string;
  /** No-ops — name and color are now set at registration time. */
  setDisplayName: (name: string) => void;
  setAvatarColor: (color: string) => void;
}

export function usePlayer(): PlayerInfo {
  const { user } = useAuth();

  return {
    playerId: user?.playerId ?? "",
    displayName: user?.displayName ?? "",
    avatarColor: user?.avatarColor ?? "#10B981",
    setDisplayName: () => {},
    setAvatarColor: () => {},
  };
}
