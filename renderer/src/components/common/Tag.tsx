import React from "react";
import { C } from "../../constants/tokens";
import { onColor, usePop } from "../../utils/helpers";

export const Tag: React.FC<{
  color: string;
  delay?: number;
  children: React.ReactNode;
}> = ({ color, delay = 0, children }) => {
  const pop = usePop(delay);

  return (
    <div
      style={{
        alignSelf: "center",
        display: "inline-flex",
        alignItems: "center",
        padding: "12px 32px",
        borderRadius: 999,
        background: color,
        border: `4px solid ${C.ink}`,
        boxShadow: `5px 5px 0 ${C.ink}`,
        color: onColor(color),
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: 3,
        textTransform: "uppercase",
        transform: `scale(${pop}) rotate(${(1 - Math.min(1, pop)) * -6}deg)`,
      }}
    >
      {children}
    </div>
  );
};
