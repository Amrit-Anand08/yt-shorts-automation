import React from "react";
import { Scene } from "../../types";
import { C, FONT_MONO, FONT_SANS } from "../../constants/tokens";
import { ellipsize, getCaption, isCodey, str } from "../../utils/helpers";
import { Tag } from "../common/Tag";
import { KineticTitle } from "../common/KineticTitle";
import { Card } from "../common/Card";
import { IdeaCard } from "../common/IdeaCard";
import { DrawArrow } from "../common/DrawArrow";
import { Stack } from "../common/Stack";
import { MascotSays } from "../mascot/MascotSays";

// Example: before/after (or problem/solution) comparison, or an analogy card.
export const ExampleLayout: React.FC<{ scene: Scene }> = ({ scene }) => {
  const compare = scene.compare;

  if (!compare || !str(compare.left_text) || !str(compare.right_text)) {
    return (
      <Stack>
        <Tag color={C.teal}>Example</Tag>
        <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />
        <IdeaCard
          label="REAL-WORLD IDEA"
          text={getCaption(scene)}
          accent={C.teal}
          background={C.tealSoft}
          start={16}
        />
        <MascotSays mood="happy" text="Makes sense, right?" delay={28} />
      </Stack>
    );
  }

  const side = (
    label: string,
    text: string,
    accent: string,
    soft: string,
    start: number,
  ) => {
    const mono = isCodey(text);
    const size = text.length <= 24 ? 46 : text.length <= 40 ? 38 : 32;

    return (
      <Card background={soft} start={start}>
        <div style={{ padding: "26px 34px 32px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 22px",
              borderRadius: 999,
              background: accent,
              border: `4px solid ${C.ink}`,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 3,
              color: C.ink,
              marginBottom: 18,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: mono ? FONT_MONO : FONT_SANS,
              fontSize: mono ? size - 6 : size,
              fontWeight: mono ? 700 : 800,
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {text}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Stack gap={34}>
      <Tag color={C.teal}>Example</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.8} delay={4} />
      <div style={{ width: "100%" }}>
        {side(
          str(compare.left_label) || "BEFORE",
          str(compare.left_text),
          C.coral,
          C.coralSoft,
          16,
        )}
        <div style={{ height: 14 }} />
        <DrawArrow start={42} />
        <div style={{ height: 14 }} />
        {side(
          str(compare.right_label) || "AFTER",
          str(compare.right_text),
          C.teal,
          C.tealSoft,
          58,
        )}
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: C.subtle,
          textAlign: "center",
        }}
      >
        {ellipsize(getCaption(scene), 80)}
      </div>
    </Stack>
  );
};
