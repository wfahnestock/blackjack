import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';

const PLAYER_ID_KEY = "bj_player_id";
const DISPLAY_NAME_KEY = "bj_display_name";
const AVATAR_COLOR_KEY = "bj_avatar_color";

export const AVATAR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export interface PlayerInfo {
  playerId: string;
  displayName: string;
  avatarColor: string;
  setDisplayName: (name: string) => void;
  setAvatarColor: (color: string) => void;
}

export function usePlayer(): PlayerInfo {
  const [playerId] = useState<string>(() => {
    const stored = localStorage.getItem(PLAYER_ID_KEY);
    if (stored) return stored;
    const id = uuidv4();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  });

  const [displayName, setDisplayNameState] = useState<string>(
    () => localStorage.getItem(DISPLAY_NAME_KEY) ?? ""
  );

  const [avatarColor, setAvatarColorState] = useState<string>(() => {
    const stored = localStorage.getItem(AVATAR_COLOR_KEY);
    if (stored) return stored;
    const color = randomColor();
    localStorage.setItem(AVATAR_COLOR_KEY, color);
    return color;
  });

  const setDisplayName = (name: string) => {
    setDisplayNameState(name);
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  };

  const setAvatarColor = (color: string) => {
    setAvatarColorState(color);
    localStorage.setItem(AVATAR_COLOR_KEY, color);
  };

  return { playerId, displayName, avatarColor, setDisplayName, setAvatarColor };
}
