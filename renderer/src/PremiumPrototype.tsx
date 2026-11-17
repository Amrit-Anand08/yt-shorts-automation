
import React from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FPS = 30;
const DURATION = 10 * FPS;

const codeLines = [
  "const numbers = [1, 2, 3, 4];",
  "",
  "const doubled = numbers.map(",
  "  (number) => number * 2",
  ");",
  "",
  "console.log(doubled);",
  "// [2, 4, 6, 8]",
];

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 45) * 35;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 20% 25%, #102C50 0%, transparent 45%), radial-gradient(ellipse at 85% 70%, #32165B 0%, transparent 42%), #050816",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(125,211,252,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.055) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          transform: `translate(${drift}px, ${-drift}px)`,
          maskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          top: 360,
          left: -260,
          background: "rgba(14,165,233,0.18)",
          filter: "blur(110px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 550,
          height: 550,
          borderRadius: "50%",
          right: -300,
          bottom: 250,
          background: "rgba(139,92,246,0.2)",
          filter: "blur(120px)",
        }}
      />
    </AbsoluteFill>
  );
};

const GlassPill: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "15px 24px",
      borderRadius: 999,
      border: "1px solid rgba(125,211,252,0.35)",
      background:
        "linear-gradient(120deg, rgba(14,165,233,0.2), rgba(139,92,246,0.2))",
      color: "#BAE6FD",
      fontSize: 23,
      fontWeight: 800,
      letterSpacing: 2,
      boxShadow: "0 12px 40px rgba(14,165,233,0.12)",
    }}
  >
    {children}
  </div>
);

const CodeCard: React.FC = () => {
  const frame = useCurrentFrame();

  const entrance = spring({
    frame: frame - 55,
    fps: FPS,
    config: { damping: 16, stiffness: 90 },
  });

  const opacity = interpolate(frame, [55, 75], [0, 1], clamp);
  const y = interpolate(entrance, [0, 1], [130, 0]);
  const scale = interpolate(entrance, [0, 1], [0.88, 1]);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 30,
        overflow: "hidden",
        border: "1px solid rgba(125,211,252,0.3)",
        background: "rgba(8,15,32,0.94)",
        boxShadow:
          "0 35px 100px rgba(0,0,0,0.45), 0 0 65px rgba(14,165,233,0.13)",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          height: 72,
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 12,
          background: "rgba(30,41,59,0.85)",
          borderBottom: "1px solid rgba(148,163,184,0.16)",
        }}
      >
        {["#FB7185", "#FBBF24", "#34D399"].map((color) => (
          <div
            key={color}
            style={{
              width: 15,
              height: 15,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 16,
            color: "#94A3B8",
            fontSize: 21,
          }}
        >
          array-methods.js
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: "#67E8F9",
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: 2,
          }}
        >
          JAVASCRIPT
        </span>
      </div>

      <div style={{ padding: "30px 20px 35px" }}>
        {codeLines.map((line, index) => {
          const lineProgress = spring({
            frame: frame - 75 - index * 5,
            fps: FPS,
            config: { damping: 18, stiffness: 120 },
          });

          const lineOpacity = interpolate(lineProgress, [0, 1], [0, 1]);
          const lineX = interpolate(lineProgress, [0, 1], [35, 0]);

          const color = line.trim().startsWith("//")
            ? "#64748B"
            : line.includes("const")
              ? "#C4B5FD"
              : line.includes("console")
                ? "#67E8F9"
                : "#E2E8F0";

          return (
            <div
              key={`${index}-${line}`}
              style={{
                display: "flex",
                minHeight: 48,
                alignItems: "center",
                fontFamily: "monospace",
                fontSize: 24,
                whiteSpace: "pre",
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                color,
              }}
            >
              <span
                style={{
                  width: 48,
                  marginRight: 22,
                  color: "#475569",
                  textAlign: "right",
                }}
              >
                {index + 1}
              </span>
              <span>{line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KineticTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["CODE", "SMARTER."];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {words.map((word, index) => {
        const start = index * 10;
        const progress = spring({
          frame: frame - start,
          fps: FPS,
          config: { damping: 11, stiffness: 130, mass: 0.7 },
        });

        const y = interpolate(progress, [0, 1], [150, 0]);
        const scale = interpolate(progress, [0, 1], [0.65, 1]);
        const rotate = interpolate(progress, [0, 1], [-7, 0]);

        return (
          <div
            key={word}
            style={{
              fontSize: 126,
              lineHeight: 1.04,
              fontWeight: 950,
              letterSpacing: -5,
              color: index === 0 ? "#FFFFFF" : "#67E8F9",
              textShadow:
                index === 0
                  ? "0 12px 45px rgba(0,0,0,0.4)"
                  : "0 0 45px rgba(34,211,238,0.4)",
              opacity: progress,
              transform: `translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`,
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
};

const FloatingSticker: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = spring({
    frame: frame - 205,
    fps: FPS,
    config: { damping: 10, stiffness: 130 },
  });

  const y = interpolate(enter, [0, 1], [100, 0]);
  const rotation = interpolate(enter, [0, 1], [-12, 4]);

  return (
    <div
      style={{
        position: "absolute",
        right: 65,
        bottom: 355,
        padding: "20px 30px",
        borderRadius: 22,
        border: "1px solid rgba(167,139,250,0.6)",
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(14,165,233,0.8))",
        color: "white",
        fontSize: 27,
        fontWeight: 950,
        letterSpacing: 2,
        boxShadow: "0 15px 50px rgba(124,58,237,0.3)",
        opacity: enter,
        transform: `translateY(${y}px) rotate(${rotation}deg)`,
      }}
    >
      ✦ LEVEL UP
    </div>
  );
};

const PremiumPrototype: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 12, 65, 80], [0, 1, 1, 0], clamp);
  const codeOpacity = interpolate(frame, [65, 85, 215, 235], [0, 1, 1, 0], clamp);
  const endOpacity = interpolate(frame, [215, 240, 285, 300], [0, 1, 1, 0], clamp);
  const progress = interpolate(
    frame,
    [0, durationInFrames],
    [0, 100],
    clamp,
  );

  return (
    <AbsoluteFill
      style={{
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <Background />

      <AbsoluteFill
        style={{
          padding: "90px 68px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              color: "#67E8F9",
              fontSize: 25,
              fontWeight: 950,
              letterSpacing: 4,
            }}
          >
            CODING GALAXY
          </div>
          <GlassPill>✦ SHORTS LAB</GlassPill>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 38,
            opacity: titleOpacity,
          }}
        >
          <GlassPill>THE DEVELOPER MINDSET</GlassPill>
          <KineticTitle />
          <div
            style={{
              color: "#CBD5E1",
              fontSize: 27,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            Small methods. Powerful results.
          </div>
        </div>

        <div
          style={{
            width: "100%",
            position: "absolute",
            top: 500,
            opacity: codeOpacity,
          }}
        >
          <div
            style={{
              marginBottom: 28,
              textAlign: "center",
              color: "#E0F2FE",
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            TRANSFORM YOUR DATA
          </div>
          <CodeCard />
        </div>

        <div
          style={{
            position: "absolute",
            top: 690,
            width: "100%",
            textAlign: "center",
            opacity: endOpacity,
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 950,
              letterSpacing: -2,
              color: "#FFFFFF",
            }}
          >
            BUILD. CREATE.
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 78,
              fontWeight: 950,
              color: "#67E8F9",
            }}
          >
            REPEAT.
          </div>
        </div>

        <FloatingSticker />

        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 16,
              color: "#94A3B8",
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 3,
            }}
          >
            <span>CODE • CREATE • GROW</span>
            <span>01 / 01</span>
          </div>
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 10,
              overflow: "hidden",
              background: "rgba(148,163,184,0.18)",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 10,
                background:
                  "linear-gradient(90deg, #0EA5E9, #8B5CF6, #67E8F9)",
                boxShadow: "0 0 22px rgba(56,189,248,0.7)",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PremiumPrototypeComposition: React.FC = () => (
  <Composition
    id="PremiumPrototype"
    component={PremiumPrototype}
    durationInFrames={DURATION}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
