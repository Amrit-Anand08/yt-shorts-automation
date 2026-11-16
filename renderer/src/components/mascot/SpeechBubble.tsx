import React from "react";
import { C } from "../../constants/tokens";
import { ellipsize, usePop } from "../../utils/helpers";

export const SpeechBubble: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 10,
}) => {
  const pop = usePop(delay);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        padding: "28px 34px",
        borderRadius: 36,
        background: C.white,
        border: `5px solid ${C.ink}`,
        boxShadow: `7px 7px 0 ${C.ink}`,
        fontSize: 38,
        fontWeight: 700,
        lineHeight: 1.28,
        color: C.ink,
        transformOrigin: "left center",
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -23,
          top: "50%",
          width: 36,
          height: 36,
          background: C.white,
          borderLeft: `5px solid ${C.ink}`,
          borderBottom: `5px solid ${C.ink}`,
          transform: "translateY(-50%) rotate(45deg)",
        }}
      />
      <span style={{ position: "relative" }}>{ellipsize(text, 110)}</span>
    </div>
  );
};
