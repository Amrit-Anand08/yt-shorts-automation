import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { C, FPS, clamp } from "../../constants/tokens";
import { str } from "../../utils/helpers";

// Swiss-style kinetic headline: masked word-by-word reveal and a marker
// highlight on the key word.
export const KineticTitle: React.FC<{
  text: string;
  scale?: number;
  delay?: number;
}> = ({ text, scale = 1, delay = 0 }) => {
  const frame = useCurrentFrame();

  const words = str(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const chars = words.join(" ").length;
  const longest = Math.max(...words.map((word) => word.length));

  const bySentence =
    chars <= 12
      ? 150
      : chars <= 20
        ? 128
        : chars <= 32
          ? 106
          : chars <= 46
            ? 88
            : 74;
  const byWord = Math.floor(900 / (longest * 0.64));
  const size = Math.round(Math.min(bySentence, byWord) * scale);

  // Highlight the longest meaningful word.
  let keyIndex = -1;
  let keyLength = 3;
  words.forEach((word, i) => {
    const length = word.replace(/[.,!?;:'"()]/g, "").length;
    if (length > keyLength) {
      keyLength = length;
      keyIndex = i;
    }
  });

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.22,
        rowGap: size * 0.04,
        textAlign: "center",
      }}
    >
      {words.map((word, i) => {
        const start = delay + i * 4;

        const progress = spring({
          frame: Math.max(0, frame - start),
          fps: FPS,
          config: { damping: 15, stiffness: 150, mass: 0.7 },
        });

        const marker = interpolate(frame - start - 8, [0, 14], [0, 1], clamp);

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              padding: "0.08em 0.05em 0.18em",
              margin: "-0.08em -0.05em -0.18em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                position: "relative",
                fontSize: size,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: C.ink,
                transform: `translateY(${(1 - Math.min(1, progress)) * 115}%)`,
              }}
            >
              {i === keyIndex && (
                <span
                  style={{
                    position: "absolute",
                    left: "-0.06em",
                    right: "-0.06em",
                    bottom: "0.08em",
                    height: "0.42em",
                    background: C.yellow,
                    transformOrigin: "left center",
                    transform: `scaleX(${marker})`,
                  }}
                />
              )}
              <span style={{ position: "relative" }}>{word}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};
