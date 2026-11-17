import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Scene } from "../../types";
import { C, FONT_MONO, clamp } from "../../constants/tokens";
import { FILE_NAMES } from "../../constants/defaults";
import { commentMarker, str, tokenizeLine, usePop } from "../../utils/helpers";

export const CodePanel: React.FC<{ scene: Scene; frames: number }> = ({
  scene,
  frames,
}) => {
  const frame = useCurrentFrame();
  const pop = usePop(8);

  const language = str(scene.code_language) || "code";
  const marker = commentMarker(language);

  const lines = str(scene.code_snippet)
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .split("\n")
    .slice(0, 10);

  const longest = Math.max(...lines.map((line) => line.length), 1);
  const fontSize =
    longest <= 30 ? 32 : longest <= 40 ? 28 : longest <= 50 ? 24 : 21;
  const lineHeight = Math.round(fontSize * 1.65);

  // The highlighted line sweeps through the code during the scene.
  const active = Math.min(
    lines.length - 1,
    Math.floor(
      interpolate(
        frame,
        [24, Math.max(25, frames - 24)],
        [0, lines.length],
        clamp,
      ),
    ),
  );

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 32,
        overflow: "hidden",
        background: C.codeBg,
        border: `5px solid ${C.ink}`,
        boxShadow: `10px 10px 0 ${C.blue}`,
        transform: `scale(${0.88 + 0.12 * pop})`,
        opacity: Math.min(1, pop * 1.4),
      }}
    >
      <div
        style={{
          height: 68,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 28px",
          background: "#262A44",
          borderBottom: `4px solid ${C.ink}`,
        }}
      >
        {[C.coral, C.yellow, C.teal].map((color) => (
          <div
            key={color}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 16,
            fontFamily: FONT_MONO,
            fontSize: 24,
            color: C.codeComment,
          }}
        >
          {FILE_NAMES[language.toLowerCase()] ?? "snippet"}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: 3,
            color: C.orange,
            textTransform: "uppercase",
          }}
        >
          {language}
        </span>
      </div>

      <div style={{ padding: "26px 0 30px" }}>
        {lines.map((line, i) => {
          const start = 10 + i * 4;
          const reveal = interpolate(frame, [start, start + 10], [0, 1], clamp);
          const isActive = i === active;

          return (
            <div
              key={`${i}-${line}`}
              style={{
                display: "flex",
                alignItems: "center",
                height: lineHeight,
                paddingRight: 24,
                fontFamily: FONT_MONO,
                fontSize,
                whiteSpace: "pre",
                opacity: reveal,
                transform: `translateX(${(1 - reveal) * 30}px)`,
                background: isActive ? "rgba(242,209,92,0.16)" : "transparent",
                borderLeft: `8px solid ${isActive ? C.orange : "transparent"}`,
              }}
            >
              <span
                style={{
                  width: 56,
                  marginRight: 18,
                  textAlign: "right",
                  color: C.codeGutter,
                }}
              >
                {i + 1}
              </span>
              <span>
                {tokenizeLine(line, marker).map((token, t) => (
                  <span key={t} style={{ color: token.color }}>
                    {token.text}
                  </span>
                ))}
                {line.length === 0 ? " " : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
