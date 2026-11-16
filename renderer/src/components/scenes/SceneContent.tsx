import React from "react";
import { Scene, SceneType } from "../../types";
import { HookLayout } from "./HookLayout";
import { ExplanationLayout } from "./ExplanationLayout";
import { CodeLayout } from "./CodeLayout";
import { ExampleLayout } from "./ExampleLayout";
import { OutroLayout } from "./OutroLayout";

export const SceneContent: React.FC<{
  scene: Scene;
  type: SceneType;
  frames: number;
  channelName: string;
}> = ({ scene, type, frames, channelName }) => {
  switch (type) {
    case "hook":
      return <HookLayout scene={scene} />;
    case "code":
      return <CodeLayout scene={scene} frames={frames} />;
    case "example":
      return <ExampleLayout scene={scene} />;
    case "outro":
      return (
        <OutroLayout scene={scene} channelName={channelName} frames={frames} />
      );
    default:
      return <ExplanationLayout scene={scene} frames={frames} />;
  }
};
