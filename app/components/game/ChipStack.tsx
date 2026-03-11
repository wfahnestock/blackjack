import { CHIP_DENOMINATIONS, CHIP_COLORS } from "~/lib/constants";

interface ChipStackProps {
  amount: number;
  size?: "sm" | "md";
}

export function ChipStack({ amount, size = "md" }: ChipStackProps) {
  if (amount === 0) return null;

  // Break down amount into chip denominations (greedy), capped at 5 chips total
  // so the stack never grows too tall for awkward bet amounts like 475.
  const MAX_VISUAL_CHIPS = 5;
  const chips: Array<{ denom: number; count: number }> = [];
  let remaining = amount;
  let totalSoFar = 0;
  for (const denom of [...CHIP_DENOMINATIONS].reverse()) {
    if (remaining >= denom && totalSoFar < MAX_VISUAL_CHIPS) {
      const count = Math.min(MAX_VISUAL_CHIPS - totalSoFar, Math.floor(remaining / denom));
      chips.push({ denom, count });
      remaining -= denom * count;
      totalSoFar += count;
    }
  }

  const chipSize = size === "sm" ? 20 : 28;
  const overlap = chipSize * 0.4;
  const totalChips = chips.reduce((a, c) => a + c.count, 0);
  const stackHeight = chipSize + (totalChips - 1) * overlap;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: chipSize, height: stackHeight }}>
        {chips.flatMap(({ denom, count }) =>
          Array.from({ length: count }).map((_, i) => (
            <div
              key={`${denom}-${i}`}
              className="absolute rounded-full border-2 shadow-md"
              style={{
                width: chipSize,
                height: chipSize,
                bottom: i * overlap,
                backgroundColor: CHIP_COLORS[denom as keyof typeof CHIP_COLORS],
                borderColor: "rgba(255,255,255,0.3)",
              }}
            />
          ))
        )}
      </div>
      <span className="text-xs font-bold text-yellow-400">{amount}</span>
    </div>
  );
}
