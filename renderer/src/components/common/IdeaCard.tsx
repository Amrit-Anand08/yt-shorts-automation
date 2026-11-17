import React from "react";
import { C } from "../../constants/tokens";
import { ellipsize } from "../../utils/helpers";
import { Card } from "./Card";

export const IdeaCard: React.FC<{
  label: string;
  text: string;
  accent: string;
  background?: string;
  start?: number;
}> = ({ label, text, accent, background = C.white, start = 14 }) => (
  <Card background={background} start={start}>
    <div style={{ display: "flex" }}>
      <div
        style={{
          width: 22,
          background: accent,
          borderRight: `5px solid ${C.ink}`,
          borderRadius: "24px 0 0 24px",
        }}
      />
      <div style={{ padding: "34px 40px" }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            color: C.subtle,
            marginBottom: 14,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.22 }}>
          {ellipsize(text, 120)}
        </div>
      </div>
    </div>
  </Card>
);
