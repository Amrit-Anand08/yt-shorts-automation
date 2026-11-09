import React from "react";
import { Scene } from "../../types";
import { C } from "../../constants/tokens";
import { getCaption } from "../../utils/helpers";
import { Tag } from "../common/Tag";
import { KineticTitle } from "../common/KineticTitle";
import { IdeaCard } from "../common/IdeaCard";
import { Stack } from "../common/Stack";
import { CodePanel } from "../code/CodePanel";

// Code: real snippet from the script, highlighted line by line.
export const CodeLayout: React.FC<{ scene: Scene; frames: number }> = ({
  scene,
  frames,
}) => (
  <Stack gap={40}>
    <Tag color={C.blue}>{"</>"} Code</Tag>
    <KineticTitle text={scene.on_screen_text} scale={0.7} delay={4} />
    <CodePanel scene={scene} frames={frames} />
    <IdeaCard
      label="KEY IDEA"
      text={getCaption(scene)}
      accent={C.orange}
      start={26}
    />
  </Stack>
);
