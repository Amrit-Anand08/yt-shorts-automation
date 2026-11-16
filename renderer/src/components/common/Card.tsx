import React from "react";
import { C } from "../../constants/tokens";
import { usePop } from "../../utils/helpers";

// A white sticker card with a hard offset shadow.
export const Card: React.FC<{
  background?: string;
  start: number;
  children: React.ReactNode;
}> = ({ background = C.white, start, children }) => {
  const pop = usePop(start);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 30,
        background,
        border: `5px solid ${C.ink}`,
        boxShadow: `8px 8px 0 ${C.ink}`,
        transform: `scale(${0.85 + 0.15 * pop})`,
        opacity: Math.min(1, pop * 1.4),
      }}
    >
      {children}
    </div>
  );
};
