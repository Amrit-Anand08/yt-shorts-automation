import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, clamp } from "../../constants/tokens";

// A line that draws itself, ending in an arrowhead.
export const DrawArrow: React.FC<{ start: number; color?: string }> = ({
  start,
  color = C.ink,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 10], [0, 1], clamp);

  return (
    <svg
      width="64"
      height="52"
      viewBox="0 0 64 52"
      style={{ display: "block", margin: "0 auto", flexShrink: 0 }}
    >
      <path
        d="M32 2 V40"
        pathLength={1}
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="1"
        strokeDashoffset={1 - p}
        opacity={p > 0 ? 1 : 0}
      />
      <path
        d="M16 28 L32 46 L48 28"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={p > 0.8 ? 1 : 0}
      />
    </svg>
  );
};
