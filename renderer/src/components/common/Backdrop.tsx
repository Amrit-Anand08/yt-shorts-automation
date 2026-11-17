import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../../constants/tokens";

// Background (continuous across scenes: no flicker between them)
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = frame * 0.35;

  return (
    <AbsoluteFill style={{ background: C.cream, overflow: "hidden" }}>
      {/* two big, pale parallax shapes */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          top: -300 + Math.sin(frame / 90) * 30,
          right: -360 + drift * 0.15,
          background: C.creamDeep,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          bottom: -260 - Math.cos(frame / 110) * 30,
          left: -300 - drift * 0.1,
          background: "#F3E6B8",
          opacity: 0.55,
        }}
      />

      {/* faint dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.ink}26 3px, transparent 3.5px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          opacity: 0.5,
        }}
      />

      {/* sticker-style frame */}
      <AbsoluteFill
        style={{
          margin: 26,
          borderRadius: 44,
          border: `4px solid ${C.ink}D9`,
        }}
      />
    </AbsoluteFill>
  );
};
