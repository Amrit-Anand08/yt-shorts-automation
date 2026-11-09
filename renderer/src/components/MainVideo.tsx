import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { VideoProps } from "../types";
import { C, FONT_SANS } from "../constants/tokens";
import { getSceneBoundaries, inferSceneType } from "../utils/helpers";
import { Backdrop } from "./common/Backdrop";
import { Chrome } from "./common/Chrome";
import { SceneShell } from "./scenes/SceneShell";
import { SceneContent } from "./scenes/SceneContent";

export const MyComponent: React.FC<VideoProps> = ({
  topic,
  channelName,
  scenes,
  audioFile,
  musicFile,
}) => {
  const boundaries = getSceneBoundaries(scenes);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.cream,
        color: C.ink,
        fontFamily: FONT_SANS,
      }}
    >
      <Backdrop />

      {scenes.map((scene, index) => {
        const from = boundaries[index];
        const frames = boundaries[index + 1] - from;
        const type = inferSceneType(scene, index, scenes.length);

        return (
          <Sequence
            key={`${index}-${scene.on_screen_text}`}
            from={from}
            durationInFrames={frames}
          >
            <>
              <SceneShell frames={frames}>
                <SceneContent
                  scene={scene}
                  type={type}
                  frames={frames}
                  channelName={channelName}
                />
              </SceneShell>

              {scene.sfxFile && (
                <Audio
                  src={staticFile(scene.sfxFile)}
                  volume={scene.sfxVolume ?? 0.35}
                />
              )}
            </>
          </Sequence>
        );
      })}

      <Chrome topic={topic} channelName={channelName} boundaries={boundaries} />

      <Audio src={staticFile(audioFile)} volume={1} />

      <Audio src={staticFile(musicFile)} volume={0.08} loop />
    </AbsoluteFill>
  );
};
