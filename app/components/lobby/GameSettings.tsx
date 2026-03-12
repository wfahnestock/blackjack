import { Input } from "~/components/ui/Input";
import type { GameSettings } from "~/lib/types";

interface GameSettingsProps {
  settings: GameSettings;
  onChange: (settings: Partial<GameSettings>) => void;
  isHost: boolean;
}

export function GameSettingsPanel({ settings, onChange, isHost }: GameSettingsProps) {
  if (!isHost) {
    return (
      <div className="flex flex-col gap-2 text-sm text-gray-500">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Table Settings
        </span>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <span>Min bet</span><span className="text-gray-300">{settings.minBet}</span>
          <span>Max bet</span><span className="text-gray-300">{settings.maxBet}</span>
          <span>Betting timer</span><span className="text-gray-300">{settings.bettingTimerSeconds}s</span>
          <span>Turn timer</span><span className="text-gray-300">{settings.turnTimerSeconds}s</span>
          <span>Count hint</span><span className="text-gray-300">{settings.allowCountingHint ? "On" : "Off"}</span>
          <span>Bankruptcy protection</span><span className="text-gray-300">{settings.bankruptcyProtection ? "On" : "Off"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Table Settings
      </span>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min Bet"
          type="number"
          value={settings.minBet}
          min={1}
          onChange={(e) => onChange({ minBet: Math.max(1, Number(e.target.value)) })}
        />
        <Input
          label="Max Bet"
          type="number"
          value={settings.maxBet}
          min={settings.minBet}
          onChange={(e) => onChange({ maxBet: Math.max(settings.minBet, Number(e.target.value)) })}
        />
        <Input
          label="Betting Timer (s)"
          type="number"
          value={settings.bettingTimerSeconds}
          min={10}
          max={120}
          onChange={(e) =>
            onChange({ bettingTimerSeconds: Math.max(10, Math.min(120, Number(e.target.value))) })
          }
        />
        <Input
          label="Turn Timer (s)"
          type="number"
          value={settings.turnTimerSeconds}
          min={15}
          max={120}
          onChange={(e) =>
            onChange({ turnTimerSeconds: Math.max(15, Math.min(120, Number(e.target.value))) })
          }
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.allowCountingHint}
          onChange={(e) => onChange({ allowCountingHint: e.target.checked })}
          className="w-4 h-4 accent-emerald-500"
        />
        <div>
          <p className="text-sm text-gray-300 font-medium">Show Hi-Lo Count Hint</p>
          <p className="text-xs text-gray-600">Displays the running card count to all players</p>
        </div>
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.bankruptcyProtection}
          onChange={(e) => onChange({ bankruptcyProtection: e.target.checked })}
          className="w-4 h-4 accent-emerald-500"
        />
        <div>
          <p className="text-sm text-gray-300 font-medium">Bankruptcy Protection</p>
          <p className="text-xs text-gray-600">Grants 100 chips to players who reach 0 so they can keep playing</p>
        </div>
      </label>
    </div>
  );
}
