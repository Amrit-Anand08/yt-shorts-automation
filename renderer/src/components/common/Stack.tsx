import React from "react";

export const Stack: React.FC<{ gap?: number; children: React.ReactNode }> = ({
  gap = 44,
  children,
}) => (
  <div
    style={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap,
    }}
  >
    {children}
  </div>
);
