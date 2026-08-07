import { Input } from "~/components/ui/Input";
import { Toggle } from "~/components/ui/Toggle";
import type { GameSettings } from "~/lib/types";

interface GameSettingsProps {
  settings: GameSettings;
  onChange: (settings: Partial<GameSettings>) => void;
  isHost: boolean;
}

/** The four boolean house rules, so the host view isn't four near-identical blocks. */
const RULES: {
  key: "allowCountingHint" | "bankruptcyProtection" | "fiveCardCharlie" | "isPrivate";
  label: string;
  hint: string;
}[] = [
  {
    key: "allowCountingHint",
    label: "Hi-Lo Count Hint",
    hint: "Shows the running card count to everyone at the table",
  },
  {
    key: "bankruptcyProtection",
    label: "Bankruptcy Protection",
    hint: "Grants 100 chips to players who reach zero so they can keep playing",
  },
  {
    key: "fiveCardCharlie",
    label: "5-Card Charlie",
    hint: "Five cards without busting wins automatically, except against a dealer natural",
  },
  {
    key: "isPrivate",
    label: "Private Table",
    hint: "Hides this table from the public browser",
  },
];

export function GameSettingsPanel({ settings, onChange, isHost }: GameSettingsProps) {
  if (!isHost) {
    const rows: [string, string][] = [
      ["Min bet", String(settings.minBet)],
      ["Max bet", String(settings.maxBet)],
      ["Betting timer", `${settings.bettingTimerSeconds}s`],
      ["Turn timer", `${settings.turnTimerSeconds}s`],
      ["Count hint", settings.allowCountingHint ? "On" : "Off"],
      ["Bankruptcy protection", settings.bankruptcyProtection ? "On" : "Off"],
      ["5-Card Charlie", settings.fiveCardCharlie ? "On" : "Off"],
      ["Visibility", settings.isPrivate ? "Private" : "Public"],
    ];

    return (
      <div className="flex flex-col gap-2.5">
        <span className="casino-eyebrow">Table Settings</span>
        <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[12.5px]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <span className="text-[#8a7f5f]">{label}</span>
              <span className="text-right tabular-nums text-[#e6d9b6]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="casino-eyebrow">Table Settings</span>

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

      <hr className="brass-rule" />

      <div className="flex flex-col gap-3.5">
        {RULES.map((rule) => (
          <div key={rule.key} className="flex items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-[#e6d9b6]">{rule.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[#7d6f4d]">
                {rule.hint}
              </span>
            </span>
            <span className="mt-0.5">
              <Toggle
                label={rule.label}
                checked={settings[rule.key]}
                /* Cast: a computed key from a union widens to an index
                   signature, which won't satisfy Partial<GameSettings>
                   because that type also has number fields. */
                onChange={(v) => onChange({ [rule.key]: v } as Partial<GameSettings>)}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
