import React from "react";
import { Mood } from "../../types";
import { Mascot } from "./Mascot";
import { SpeechBubble } from "./SpeechBubble";

export const MascotSays: React.FC<{ mood: Mood; text: string; delay?: number }> = ({
  mood,
  text,
  delay = 8,
}) => (
  <div
    style={{ width: "100%", display: "flex", alignItems: "center", gap: 36 }}
  >
    <Mascot mood={mood} delay={delay} />
    <SpeechBubble text={text} delay={delay + 6} />
  </div>
);
