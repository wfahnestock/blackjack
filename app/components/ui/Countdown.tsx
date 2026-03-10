import { useEffect, useState } from "react";

interface CountdownProps {
  endsAt: number | null;
  totalSeconds: number;
  size?: number;
}

export function Countdown({ endsAt, totalSeconds, size = 48 }: CountdownProps) {
  const [remaining, setRemaining] = useState<number>(totalSeconds);

  useEffect(() => {
    if (!endsAt) return;

    const update = () => {
      const diff = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(diff);
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = endsAt ? Math.min(1, remaining / totalSeconds) : 1;
  const strokeDashoffset = circumference * (1 - progress);

  const color =
    progress > 0.5
      ? "#10B981" // emerald
      : progress > 0.25
      ? "#F59E0B" // amber
      : "#EF4444"; // red

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={{ position: "absolute" }}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth={4}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.5s" }}
        />
      </svg>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>
        {remaining}
      </span>
    </div>
  );
}
