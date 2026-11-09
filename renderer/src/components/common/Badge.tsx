import React from "react";
import { C } from "../../constants/tokens";
import { onColor } from "../../utils/helpers";

export const Badge: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => (
  <div
    style={{
      width: 68,
      height: 68,
      flexShrink: 0,
      borderRadius: "50%",
      background: color,
      border: `5px solid ${C.ink}`,
      color: onColor(color),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 34,
      fontWeight: 900,
    }}
  >
    {label}
  </div>
);
