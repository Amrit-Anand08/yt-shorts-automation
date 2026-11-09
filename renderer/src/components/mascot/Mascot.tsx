import React from "react";
import { useCurrentFrame } from "remotion";
import { Mood } from "../../types";
import { C } from "../../constants/tokens";
import { usePop } from "../../utils/helpers";

// Flat vector robot mascot. One focal character, used for emotion only.
export const Mascot: React.FC<{ mood: Mood; size?: number; delay?: number }> = ({
  mood,
  size = 230,
  delay = 6,
}) => {
  const frame = useCurrentFrame();
  const pop = usePop(delay);

  const bob = Math.sin(frame / 12) * 7;
  const antenna = Math.sin(frame / 8) * 10;
  const blink = frame % 90 > 84 ? 0.12 : 1;

  const sway = Math.sin(frame / 14) * 6;
  const rightArm =
    mood === "wave"
      ? -110 + Math.sin(frame / 3.5) * 20
      : mood === "wow"
        ? -75
        : mood === "think"
          ? -40
          : -10 + sway;
  const leftArm = mood === "wow" ? 75 : mood === "happy" ? 10 - sway : sway;

  const eyeRy = (mood === "wow" ? 17 : 14) * blink;
  const look = mood === "think" ? { x: 5, y: -5 } : { x: 0, y: 0 };

  const Arm = ({
    cx,
    cy,
    dx,
    dy,
    angle,
  }: {
    cx: number;
    cy: number;
    dx: number;
    dy: number;
    angle: number;
  }) => (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <line
        x1={cx}
        y1={cy}
        x2={cx + dx}
        y2={cy + dy}
        stroke={C.ink}
        strokeWidth="28"
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx + dx}
        y2={cy + dy}
        stroke={C.blue}
        strokeWidth="14"
        strokeLinecap="round"
      />
    </g>
  );

  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 260 285"
      style={{
        overflow: "visible",
        flexShrink: 0,
        transform: `scale(${pop})`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* ground shadow */}
      <ellipse
        cx="130"
        cy="266"
        rx={70 - bob}
        ry="10"
        fill={C.ink}
        opacity="0.12"
      />

      <g transform={`translate(0 ${bob})`}>
        {/* antenna */}
        <g transform={`rotate(${antenna} 130 62)`}>
          <line
            x1="130"
            y1="62"
            x2="130"
            y2="28"
            stroke={C.ink}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle
            cx="130"
            cy="20"
            r="13"
            fill={C.orange}
            stroke={C.ink}
            strokeWidth="6"
          />
        </g>

        {/* feet */}
        <rect
          x="76"
          y="222"
          width="44"
          height="32"
          rx="14"
          fill={C.orange}
          stroke={C.ink}
          strokeWidth="6"
        />
        <rect
          x="140"
          y="222"
          width="44"
          height="32"
          rx="14"
          fill={C.orange}
          stroke={C.ink}
          strokeWidth="6"
        />

        {/* arms (behind the body) */}
        <Arm cx={54} cy={152} dx={-30} dy={38} angle={leftArm} />
        <Arm cx={206} cy={152} dx={30} dy={38} angle={rightArm} />

        {/* body */}
        <rect
          x="44"
          y="62"
          width="172"
          height="168"
          rx="52"
          fill={C.blue}
          stroke={C.ink}
          strokeWidth="7"
        />

        {/* screen */}
        <rect
          x="68"
          y="92"
          width="124"
          height="92"
          rx="32"
          fill={C.cream}
          stroke={C.ink}
          strokeWidth="6"
        />

        {/* eyes */}
        {[104, 156].map((cx) => (
          <g key={cx}>
            <ellipse
              cx={cx + look.x}
              cy={132 + look.y}
              rx="10"
              ry={eyeRy}
              fill={C.ink}
            />
            {blink === 1 && (
              <circle
                cx={cx + look.x + 3}
                cy={126 + look.y}
                r="3.5"
                fill={C.white}
              />
            )}
          </g>
        ))}

        {/* cheeks */}
        <circle cx="86" cy="158" r="9" fill={C.coral} opacity="0.6" />
        <circle cx="174" cy="158" r="9" fill={C.coral} opacity="0.6" />

        {/* mouth */}
        {mood === "wow" && (
          <ellipse cx="130" cy="166" rx="11" ry="14" fill={C.ink} />
        )}
        {mood === "think" && (
          <path
            d="M114 168 H146"
            stroke={C.ink}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}
        {mood === "happy" && (
          <path
            d="M108 160 Q130 182 152 160"
            stroke={C.ink}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mood === "wave" && (
          <path
            d="M106 158 Q130 190 154 158 Z"
            fill={C.coral}
            stroke={C.ink}
            strokeWidth="5"
            strokeLinejoin="round"
          />
        )}

        {/* chest light */}
        <circle
          cx="130"
          cy="208"
          r="8"
          fill={C.yellow}
          stroke={C.ink}
          strokeWidth="4"
        />
      </g>
    </svg>
  );
};
