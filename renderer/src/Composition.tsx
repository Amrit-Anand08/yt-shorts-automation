import React from "react";
import { Composition } from "remotion";
import { FPS } from "./constants/tokens";
import { defaultProps } from "./constants/defaults";
import { calculateMetadata } from "./utils/helpers";
import { MyComponent } from "./components/MainVideo";

export const MyComposition: React.FC = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={300}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};

// Re-exports for backwards compatibility with any direct consumers
export { MyComponent };
export * from "./types";
export * from "./constants";
export * from "./utils";
export * from "./components";
