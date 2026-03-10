import { Input } from "~/components/ui/Input";
import { AVATAR_COLORS } from "~/lib/usePlayer";

interface PlayerSetupProps {
  displayName: string;
  avatarColor: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
}

export function PlayerSetup({
  displayName,
  avatarColor,
  onNameChange,
  onColorChange,
}: PlayerSetupProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Your Name"
        id="display-name"
        value={displayName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Enter your name..."
        maxLength={20}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-300">Avatar Color</span>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
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
  );
}
