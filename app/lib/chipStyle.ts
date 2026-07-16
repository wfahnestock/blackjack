import type { CSSProperties } from "react";
import { CHIP_COLORS } from "./constants";

/** Light tint per denomination, used for the alternating pinwheel wedges. */
const CHIP_LIGHT: Record<number, string> = {
  5:   "#FEE2E2", // red
  10:  "#DBEAFE", // blue
  25:  "#D1FAE5", // green
  50:  "#FEF3C7", // amber
  100: "#EDE9FE", // purple
  500: "#D6DBE4", // slate
};

/**
 * Casino chip styling: a repeating conic-gradient pinwheel in the denomination's
 * color, with inset highlight/shadow and a drop shadow for a 3D pressed-clay look.
 * Mirrors the reference simulator's chip CSS.
 */
export function chipStyle(denom: number, size: number): CSSProperties {
  const main = CHIP_COLORS[denom as keyof typeof CHIP_COLORS] ?? "#DC2626";
  const light = CHIP_LIGHT[denom] ?? "#FEE2E2";
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `repeating-conic-gradient(${main} 0deg, ${main} 30deg, ${light} 30deg, ${light} 60deg)`,
    boxShadow:
      "rgba(255,255,255,0.25) 0px 1px 0px inset, rgba(0,0,0,0.35) 0px -1px 0px inset, rgba(0,0,0,0.5) 0px 1px 1px, rgba(0,0,0,0.45) 0px 3px 6px",
    border: "1.5px solid rgba(0,0,0,0.3)",
  };
}

/**
 * The value inlay at the center of a chip: a light disc with the denomination's
 * color for text and border. Mirrors the reference simulator's center style.
 */
export function chipCenterStyle(denom: number): CSSProperties {
  const main = CHIP_COLORS[denom as keyof typeof CHIP_COLORS] ?? "#DC2626";
  const light = CHIP_LIGHT[denom] ?? "#FEE2E2";
  return {
    width: "62%",
    height: "62%",
    borderRadius: "50%",
    background: light,
    color: main,
    border: `1.5px solid ${main}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
