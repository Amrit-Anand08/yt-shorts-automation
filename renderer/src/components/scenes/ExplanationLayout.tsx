import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Scene } from "../../types";
import { C, clamp } from "../../constants/tokens";
import { ellipsize, getCaption, getPoints, pointColor } from "../../utils/helpers";
import { Tag } from "../common/Tag";
import { KineticTitle } from "../common/KineticTitle";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { IdeaCard } from "../common/IdeaCard";
import { DrawArrow } from "../common/DrawArrow";
import { Stack } from "../common/Stack";
import { MascotSays } from "../mascot/MascotSays";

// Explanation: step-by-step flow diagram with drawn arrows.
export const ExplanationLayout: React.FC<{ scene: Scene; frames: number }> = ({
  scene,
  frames,
}) => {
  const frame = useCurrentFrame();
  const points = getPoints(scene);
  const caption = getCaption(scene);

  if (points.length < 2) {
    return (
      <Stack>
        <Tag color={C.blue}>Concept</Tag>
        <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />
        <IdeaCard label="THE IDEA" text={caption} accent={C.blue} start={16} />
        <MascotSays mood="think" text="Keep this in mind!" delay={28} />
      </Stack>
    );
  }

  // Steps appear evenly through the scene instead of all at once.
  const step = Math.max(10, Math.min(28, (frames - 50) / points.length));

  return (
    <Stack gap={36}>
      <Tag color={C.blue}>Concept</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.8} delay={4} />

      <div style={{ width: "100%" }}>
        {points.map((point, i) => {
          const start = 18 + i * step;
          const color = pointColor(i, points.length);
          const isLast = i === points.length - 1;

          return (
            <React.Fragment key={`${i}-${point}`}>
              <Card background={isLast ? C.orangeSoft : C.white} start={start}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                    padding: "22px 30px",
                  }}
                >
                  <Badge color={color} label={String(i + 1)} />
                  <div
                    style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15 }}
                  >
                    {ellipsize(point, 50)}
                  </div>
                </div>
              </Card>
              {!isLast && <DrawArrow start={start + 12} />}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: C.subtle,
          textAlign: "center",
          lineHeight: 1.3,
          opacity: interpolate(
            frame,
            [18 + points.length * step, 30 + points.length * step],
            [0, 1],
            clamp,
          ),
        }}
      >
        {ellipsize(caption, 80)}
      </div>
    </Stack>
  );
};
