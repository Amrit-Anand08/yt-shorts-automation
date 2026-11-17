
import React from "react";
import { MyComposition } from "./Composition";
import { PremiumPrototypeComposition } from "./PremiumPrototype";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <PremiumPrototypeComposition />
    </>
  );
};
