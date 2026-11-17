import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Scene } from "../../types";
import { C, clamp } from "../../constants/tokens";
import { getCaption } from "../../utils/helpers";
import { Tag } from "../common/Tag";
import { KineticTitle } from "../common/KineticTitle";
import { Stack } from "../common/Stack";
import { MascotSays } from "../mascot/MascotSays";

// Hook: Swiss kinetic typography + cartoon mascot.
export const HookLayout: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const rule = interpolate(frame, [18, 36], [0, 1], clamp);

  return (
    <Stack gap={52}>
      <Tag color={C.orange}>Did you know?</Tag>
      <KineticTitle text={scene.on_screen_text} delay={4} />
      <div
        style={{
          width: 300,
          height: 14,
          background: C.ink,
          borderRadius: 7,
          transformOrigin: "left center",
          transform: `scaleX(${rule})`,
        }}
      />
      <MascotSays mood="wow" text={getCaption(scene)} delay={22} />
    </Stack>
  );
};
