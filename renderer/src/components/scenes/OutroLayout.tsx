import React from "react";
import { useCurrentFrame } from "remotion";
import { Scene } from "../../types";
import { C } from "../../constants/tokens";
import { ellipsize, getCaption, getPoints } from "../../utils/helpers";
import { Tag } from "../common/Tag";
import { KineticTitle } from "../common/KineticTitle";
import { Card } from "../common/Card";
import { IdeaCard } from "../common/IdeaCard";
import { Stack } from "../common/Stack";
import { Mascot } from "../mascot/Mascot";

// Outro: recap checklist + subscribe button with a waving mascot.
export const OutroLayout: React.FC<{
  scene: Scene;
  channelName: string;
  frames: number;
}> = ({ scene, channelName, frames }) => {
  const frame = useCurrentFrame();
  const points = getPoints(scene).slice(0, 3);
  const pulse = 1 + Math.sin(frame / 6) * 0.025;

  const step = Math.max(
    10,
    Math.min(24, (frames - 60) / Math.max(1, points.length)),
  );

  return (
    <Stack gap={40}>
      <Tag color={C.orange}>{points.length ? "Recap" : "You made it!"}</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />

      {points.length > 0 ? (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {points.map((point, i) => (
            <Card key={`${i}-${point}`} start={16 + i * step}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  padding: "20px 30px",
                }}
              >
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 60 60"
                  style={{ flexShrink: 0 }}
                >
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    fill={C.teal}
                    stroke={C.ink}
                    strokeWidth="5"
                  />
                  <path
                    d="M17 31 L26 40 L43 21"
                    stroke={C.ink}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <div
                  style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}
                >
                  {ellipsize(point, 46)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <IdeaCard
          label="REMEMBER"
          text={getCaption(scene)}
          accent={C.orange}
          start={16}
        />
      )}

      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 34,
        }}
      >
        <Mascot mood="wave" size={210} delay={30} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "26px 48px",
              borderRadius: 999,
              background: C.orange,
              border: `5px solid ${C.ink}`,
              boxShadow: `8px 8px 0 ${C.ink}`,
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: 3,
              transform: `scale(${pulse})`,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40">
              <path
                d="M10 6 L34 20 L10 34 Z"
                fill={C.ink}
                strokeLinejoin="round"
                stroke={C.ink}
                strokeWidth="4"
              />
            </svg>
            SUBSCRIBE
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 4,
              color: C.ink,
              textTransform: "uppercase",
            }}
          >
            {channelName}
          </div>
        </div>
      </div>
    </Stack>
  );
};
