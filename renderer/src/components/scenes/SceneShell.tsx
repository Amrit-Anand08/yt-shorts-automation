import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../../constants/tokens";

// Scene shell: safe-area box, entrance and exit
export const SceneShell: React.FC<{ frames: number; children: React.ReactNode }> = ({
  frames,
  children,
}) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 6], [0, 1], clamp);
  const fadeOut = interpolate(frame, [frames - 8, frames], [1, 0], clamp);
  const rise = interpolate(frame, [0, 10], [36, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        top: 200,
        bottom: 330,
        left: 64,
        right: 64,
        width: "auto",
        height: "auto",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(fadeIn, fadeOut),
        transform: `translateY(${rise}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
