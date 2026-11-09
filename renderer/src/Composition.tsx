import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { Audio } from "@remotion/media";

// ==================================================
// Types
// ==================================================

type SceneType = "hook" | "explanation" | "code" | "example" | "outro";

type Compare = {
  left_label?: string;
  left_text: string;
  right_label?: string;
  right_text: string;
};

type Scene = {
  duration: number;
  voiceover: string;
  on_screen_text: string;
  visual_description?: string; // director note, never rendered
  scene_type?: SceneType;
  caption?: string;
  points?: string[];
  code_snippet?: string;
  code_language?: string;
  compare?: Compare;
  sfxFile?: string;
  sfxVolume?: number;
};

type VideoProps = {
  topic: string;
  channelName: string;
  scenes: Scene[];
  audioFile: string;
  musicFile: string;
};

type Mood = "wow" | "think" | "happy" | "wave";

// ==================================================
// Design tokens: "Modern Cartoon Vector Motion Graphics"
// ==================================================

const C = {
  cream: "#F6F1E7",
  creamDeep: "#EDE6D6",
  ink: "#20243A",
  blue: "#4C83E6", // data, software
  teal: "#35A99A", // success, flow, active process
  orange: "#F39A45", // key insight
  coral: "#E76F6A", // problem, contrast
  yellow: "#F2D15C", // highlight
  grey: "#9AA1AE", // inactive
  white: "#FFFFFF",
  blueSoft: "#DCE7FB",
  tealSoft: "#D5EEEA",
  orangeSoft: "#FCE5CF",
  coralSoft: "#F9DAD8",
  subtle: "#6B7288",
  codeBg: "#191C30",
  codeText: "#E8EAF2",
  codeKeyword: "#F39A45",
  codeString: "#6FD3C3",
  codeNumber: "#F2D15C",
  codeFn: "#8DB4FF",
  codeComment: "#8A90A6",
  codeGutter: "#5A6080",
};

// Two font families only. Add @remotion/google-fonts (Inter + JetBrains Mono)
// or bundle the files in /public to get exactly these fonts in the renderer;
// until then the system fallbacks below are used.
const FONT_SANS = `"Geist", "Inter", "Manrope", "Segoe UI", Arial, Helvetica, sans-serif`;
const FONT_MONO = `"JetBrains Mono", "IBM Plex Mono", "Fira Code", Menlo, Consolas, monospace`;

const FPS = 30;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ==================================================
// Default props (used by Remotion Studio previews)
// ==================================================

const defaultProps: VideoProps = {
  topic: "JavaScript Array Methods",
  channelName: "CODING GALAXY",
  scenes: [
    {
      duration: 5,
      scene_type: "hook",
      voiceover:
        "Still using for loops for everything? There is a cleaner way.",
      on_screen_text: "STOP USING LOOPS",
      caption: "Arrays have built-in superpowers. Let's meet one.",
    },
    {
      duration: 6,
      scene_type: "explanation",
      voiceover: "Map takes every item, changes it, and gives you a new array.",
      on_screen_text: "WHAT IS MAP?",
      caption: "A new array, same length, new values.",
      points: [
        "Take an array",
        "Run a function on each item",
        "Get a new array back",
      ],
    },
    {
      duration: 7,
      scene_type: "code",
      voiceover: "Here we double every number in one line.",
      on_screen_text: "MAP IN ACTION",
      caption: "The arrow function runs once per item.",
      code_language: "javascript",
      code_snippet:
        "const nums = [1, 2, 3];\n\nconst doubled = nums.map(\n  (n) => n * 2\n);\n\nconsole.log(doubled);\n// [2, 4, 6]",
    },
    {
      duration: 6,
      scene_type: "example",
      voiceover: "Compare that with the old loop, which needs more lines.",
      on_screen_text: "LOOP VS MAP",
      caption: "Same result, far less code.",
      compare: {
        left_label: "BEFORE",
        left_text: "for (let i...) { push }",
        right_label: "AFTER",
        right_text: "nums.map(n => n * 2)",
      },
    },
    {
      duration: 5,
      scene_type: "outro",
      voiceover: "Try map today, and subscribe for more.",
      on_screen_text: "NOW YOU TRY",
      caption: "See you in the next one!",
      points: [
        "Map transforms items",
        "It returns a new array",
        "No manual loop needed",
      ],
    },
  ],
  audioFile: "audio/gemini-voice-test.wav",
  musicFile: "audio/background-music.wav",
};

// ==================================================
// Timing: integer frame boundaries (no fractional frames)
// ==================================================

const sceneSeconds = (scene: Scene) => Math.max(1, Number(scene.duration) || 1);

// boundaries[i] is the first frame of scene i; the last entry is the total.
// Rounding is done on the running total, so scenes never drift from the audio,
// and the last boundary is rounded UP so the narration is never cut off.
const getSceneBoundaries = (scenes: Scene[]): number[] => {
  const boundaries = [0];
  let seconds = 0;

  scenes.forEach((scene, index) => {
    seconds += sceneSeconds(scene);

    const isLast = index === scenes.length - 1;
    const frame = isLast
      ? Math.ceil(seconds * FPS - 1e-6)
      : Math.round(seconds * FPS);

    boundaries.push(frame);
  });

  for (let i = 1; i < boundaries.length; i += 1) {
    if (boundaries[i] <= boundaries[i - 1]) {
      boundaries[i] = boundaries[i - 1] + 1;
    }
  }

  return boundaries;
};

const getDurationInFrames = (scenes: Scene[]) => {
  const boundaries = getSceneBoundaries(scenes);
  return Math.max(1, boundaries[boundaries.length - 1]);
};

const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({
  props,
}) => ({
  durationInFrames: getDurationInFrames(props.scenes),
});

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

// ==================================================
// Text helpers
// ==================================================

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const ellipsize = (text: string, max: number) => {
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");

  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
};

const firstSentence = (text: string) => {
  const clean = str(text);
  const match = clean.match(/^.*?[.!?।](\s|$)/);

  return (match ? match[0] : clean).trim();
};

// Caption shown on screen. Never the director note (visual_description).
const getCaption = (scene: Scene) =>
  str(scene.caption) || ellipsize(firstSentence(scene.voiceover), 100);

const getPoints = (scene: Scene): string[] =>
  Array.isArray(scene.points)
    ? scene.points.map(str).filter(Boolean).slice(0, 4)
    : [];

const isCodey = (text: string) => /[{};=<>]|=>|\(\)|\w\(.*\)|\[.*\]/.test(text);

const onColor = (background: string) =>
  background === C.blue ? C.white : C.ink;

// Blue = start / data, teal = process, orange = the key insight at the end.
const pointColor = (index: number, count: number) => {
  if (count > 1 && index === count - 1) return C.orange;
  return index === 0 ? C.blue : C.teal;
};

const inferSceneType = (
  scene: Scene,
  index: number,
  total: number,
): SceneType => {
  const hasCode = str(scene.code_snippet).length > 0;
  const type = scene.scene_type;

  if (type === "code") return hasCode ? "code" : "explanation";
  if (
    type === "hook" ||
    type === "explanation" ||
    type === "example" ||
    type === "outro"
  ) {
    return type;
  }

  // The scene type was missing or unknown: infer from the content.
  if (index === 0) return "hook";
  if (index === total - 1 && total > 1) return "outro";
  if (hasCode) return "code";
  if (scene.compare) return "example";
  return "explanation";
};

// ==================================================
// Motion helpers
// ==================================================

// Pop-in with restrained overshoot.
const usePop = (delay = 0) => {
  const frame = useCurrentFrame();

  return spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: { damping: 13, stiffness: 170, mass: 0.7 },
  });
};

// ==================================================
// Background (continuous across scenes: no flicker between them)
// ==================================================

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = frame * 0.35;

  return (
    <AbsoluteFill style={{ background: C.cream, overflow: "hidden" }}>
      {/* two big, pale parallax shapes */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          top: -300 + Math.sin(frame / 90) * 30,
          right: -360 + drift * 0.15,
          background: C.creamDeep,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          bottom: -260 - Math.cos(frame / 110) * 30,
          left: -300 - drift * 0.1,
          background: "#F3E6B8",
          opacity: 0.55,
        }}
      />

      {/* faint dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.ink}26 3px, transparent 3.5px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          opacity: 0.5,
        }}
      />

      {/* sticker-style frame */}
      <AbsoluteFill
        style={{
          margin: 26,
          borderRadius: 44,
          border: `4px solid ${C.ink}D9`,
        }}
      />
    </AbsoluteFill>
  );
};

// ==================================================
// Persistent header and footer (outside the scene sequences)
// ==================================================

const Chrome: React.FC<{
  topic: string;
  channelName: string;
  boundaries: number[];
}> = ({ topic, channelName, boundaries }) => {
  const frame = useCurrentFrame();

  const sceneCount = boundaries.length - 1;
  const total = Math.max(1, boundaries[boundaries.length - 1]);

  let activeIndex = 0;
  for (let i = 0; i < sceneCount; i += 1) {
    if (frame >= boundaries[i]) activeIndex = i;
  }

  const progress = Math.min(100, (frame / total) * 100);

  return (
    <>
      {/* HEADER */}
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 64,
          right: 64,
          height: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 28px 12px 16px",
            borderRadius: 999,
            background: C.white,
            border: `4px solid ${C.ink}`,
            boxShadow: `5px 5px 0 ${C.ink}`,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24">
            <path
              d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z"
              fill={C.yellow}
              stroke={C.ink}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: 3,
              color: C.ink,
              textTransform: "uppercase",
            }}
          >
            {channelName}
          </span>
        </div>

        {sceneCount <= 12 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Array.from({ length: sceneCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIndex ? 46 : 16,
                  height: 16,
                  borderRadius: 8,
                  background:
                    i === activeIndex
                      ? C.orange
                      : i < activeIndex
                        ? C.teal
                        : `${C.ink}30`,
                  border: `3px solid ${C.ink}`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 210,
        }}
      >
        <div
          style={{
            marginBottom: 14,
            fontSize: 28,
            fontWeight: 700,
            color: C.subtle,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {topic}
        </div>

        <div
          style={{
            height: 22,
            borderRadius: 14,
            background: C.white,
            border: `4px solid ${C.ink}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: C.teal,
            }}
          />
        </div>
      </div>
    </>
  );
};

// ==================================================
// Reusable pieces
// ==================================================

const Tag: React.FC<{
  color: string;
  delay?: number;
  children: React.ReactNode;
}> = ({ color, delay = 0, children }) => {
  const pop = usePop(delay);

  return (
    <div
      style={{
        alignSelf: "center",
        display: "inline-flex",
        alignItems: "center",
        padding: "12px 32px",
        borderRadius: 999,
        background: color,
        border: `4px solid ${C.ink}`,
        boxShadow: `5px 5px 0 ${C.ink}`,
        color: onColor(color),
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: 3,
        textTransform: "uppercase",
        transform: `scale(${pop}) rotate(${(1 - Math.min(1, pop)) * -6}deg)`,
      }}
    >
      {children}
    </div>
  );
};

// Swiss-style kinetic headline: masked word-by-word reveal and a marker
// highlight on the key word.
const KineticTitle: React.FC<{
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

// Flat vector robot mascot. One focal character, used for emotion only.
const Mascot: React.FC<{ mood: Mood; size?: number; delay?: number }> = ({
  mood,
  size = 230,
  delay = 6,
}) => {
  const frame = useCurrentFrame();
  const pop = usePop(delay);

  const bob = Math.sin(frame / 12) * 7;
  const antenna = Math.sin(frame / 8) * 10;
  const blink = frame % 90 > 84 ? 0.12 : 1;

  const sway = Math.sin(frame / 14) * 6;
  const rightArm =
    mood === "wave"
      ? -110 + Math.sin(frame / 3.5) * 20
      : mood === "wow"
        ? -75
        : mood === "think"
          ? -40
          : -10 + sway;
  const leftArm = mood === "wow" ? 75 : mood === "happy" ? 10 - sway : sway;

  const eyeRy = (mood === "wow" ? 17 : 14) * blink;
  const look = mood === "think" ? { x: 5, y: -5 } : { x: 0, y: 0 };

  const Arm = ({
    cx,
    cy,
    dx,
    dy,
    angle,
  }: {
    cx: number;
    cy: number;
    dx: number;
    dy: number;
    angle: number;
  }) => (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <line
        x1={cx}
        y1={cy}
        x2={cx + dx}
        y2={cy + dy}
        stroke={C.ink}
        strokeWidth="28"
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx + dx}
        y2={cy + dy}
        stroke={C.blue}
        strokeWidth="14"
        strokeLinecap="round"
      />
    </g>
  );

  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 260 285"
      style={{
        overflow: "visible",
        flexShrink: 0,
        transform: `scale(${pop})`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* ground shadow */}
      <ellipse
        cx="130"
        cy="266"
        rx={70 - bob}
        ry="10"
        fill={C.ink}
        opacity="0.12"
      />

      <g transform={`translate(0 ${bob})`}>
        {/* antenna */}
        <g transform={`rotate(${antenna} 130 62)`}>
          <line
            x1="130"
            y1="62"
            x2="130"
            y2="28"
            stroke={C.ink}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle
            cx="130"
            cy="20"
            r="13"
            fill={C.orange}
            stroke={C.ink}
            strokeWidth="6"
          />
        </g>

        {/* feet */}
        <rect
          x="76"
          y="222"
          width="44"
          height="32"
          rx="14"
          fill={C.orange}
          stroke={C.ink}
          strokeWidth="6"
        />
        <rect
          x="140"
          y="222"
          width="44"
          height="32"
          rx="14"
          fill={C.orange}
          stroke={C.ink}
          strokeWidth="6"
        />

        {/* arms (behind the body) */}
        <Arm cx={54} cy={152} dx={-30} dy={38} angle={leftArm} />
        <Arm cx={206} cy={152} dx={30} dy={38} angle={rightArm} />

        {/* body */}
        <rect
          x="44"
          y="62"
          width="172"
          height="168"
          rx="52"
          fill={C.blue}
          stroke={C.ink}
          strokeWidth="7"
        />

        {/* screen */}
        <rect
          x="68"
          y="92"
          width="124"
          height="92"
          rx="32"
          fill={C.cream}
          stroke={C.ink}
          strokeWidth="6"
        />

        {/* eyes */}
        {[104, 156].map((cx) => (
          <g key={cx}>
            <ellipse
              cx={cx + look.x}
              cy={132 + look.y}
              rx="10"
              ry={eyeRy}
              fill={C.ink}
            />
            {blink === 1 && (
              <circle
                cx={cx + look.x + 3}
                cy={126 + look.y}
                r="3.5"
                fill={C.white}
              />
            )}
          </g>
        ))}

        {/* cheeks */}
        <circle cx="86" cy="158" r="9" fill={C.coral} opacity="0.6" />
        <circle cx="174" cy="158" r="9" fill={C.coral} opacity="0.6" />

        {/* mouth */}
        {mood === "wow" && (
          <ellipse cx="130" cy="166" rx="11" ry="14" fill={C.ink} />
        )}
        {mood === "think" && (
          <path
            d="M114 168 H146"
            stroke={C.ink}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}
        {mood === "happy" && (
          <path
            d="M108 160 Q130 182 152 160"
            stroke={C.ink}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mood === "wave" && (
          <path
            d="M106 158 Q130 190 154 158 Z"
            fill={C.coral}
            stroke={C.ink}
            strokeWidth="5"
            strokeLinejoin="round"
          />
        )}

        {/* chest light */}
        <circle
          cx="130"
          cy="208"
          r="8"
          fill={C.yellow}
          stroke={C.ink}
          strokeWidth="4"
        />
      </g>
    </svg>
  );
};

const SpeechBubble: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 10,
}) => {
  const pop = usePop(delay);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        padding: "28px 34px",
        borderRadius: 36,
        background: C.white,
        border: `5px solid ${C.ink}`,
        boxShadow: `7px 7px 0 ${C.ink}`,
        fontSize: 38,
        fontWeight: 700,
        lineHeight: 1.28,
        color: C.ink,
        transformOrigin: "left center",
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -23,
          top: "50%",
          width: 36,
          height: 36,
          background: C.white,
          borderLeft: `5px solid ${C.ink}`,
          borderBottom: `5px solid ${C.ink}`,
          transform: "translateY(-50%) rotate(45deg)",
        }}
      />
      <span style={{ position: "relative" }}>{ellipsize(text, 110)}</span>
    </div>
  );
};

const MascotSays: React.FC<{ mood: Mood; text: string; delay?: number }> = ({
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

// A line that draws itself, ending in an arrowhead.
const DrawArrow: React.FC<{ start: number; color?: string }> = ({
  start,
  color = C.ink,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 10], [0, 1], clamp);

  return (
    <svg
      width="64"
      height="52"
      viewBox="0 0 64 52"
      style={{ display: "block", margin: "0 auto", flexShrink: 0 }}
    >
      <path
        d="M32 2 V40"
        pathLength={1}
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="1"
        strokeDashoffset={1 - p}
        opacity={p > 0 ? 1 : 0}
      />
      <path
        d="M16 28 L32 46 L48 28"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={p > 0.8 ? 1 : 0}
      />
    </svg>
  );
};

// A white sticker card with a hard offset shadow.
const Card: React.FC<{
  background?: string;
  start: number;
  children: React.ReactNode;
}> = ({ background = C.white, start, children }) => {
  const pop = usePop(start);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 30,
        background,
        border: `5px solid ${C.ink}`,
        boxShadow: `8px 8px 0 ${C.ink}`,
        transform: `scale(${0.85 + 0.15 * pop})`,
        opacity: Math.min(1, pop * 1.4),
      }}
    >
      {children}
    </div>
  );
};

const Badge: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => (
  <div
    style={{
      width: 68,
      height: 68,
      flexShrink: 0,
      borderRadius: "50%",
      background: color,
      border: `5px solid ${C.ink}`,
      color: onColor(color),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 34,
      fontWeight: 900,
    }}
  >
    {label}
  </div>
);

const IdeaCard: React.FC<{
  label: string;
  text: string;
  accent: string;
  background?: string;
  start?: number;
}> = ({ label, text, accent, background = C.white, start = 14 }) => (
  <Card background={background} start={start}>
    <div style={{ display: "flex" }}>
      <div
        style={{
          width: 22,
          background: accent,
          borderRight: `5px solid ${C.ink}`,
          borderRadius: "24px 0 0 24px",
        }}
      />
      <div style={{ padding: "34px 40px" }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            color: C.subtle,
            marginBottom: 14,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.22 }}>
          {ellipsize(text, 120)}
        </div>
      </div>
    </div>
  </Card>
);

// ==================================================
// Code panel with syntax colours and a moving active line
// ==================================================

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "class",
  "extends",
  "new",
  "this",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "true",
  "false",
  "null",
  "undefined",
  "def",
  "lambda",
  "None",
  "True",
  "False",
  "self",
  "elif",
  "pass",
  "with",
  "as",
  "int",
  "float",
  "double",
  "char",
  "boolean",
  "void",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "package",
  "interface",
  "enum",
  "struct",
  "fn",
  "pub",
  "mut",
  "use",
  "impl",
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "ON",
  "GROUP",
  "BY",
  "ORDER",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "LIMIT",
  "AS",
]);

const CODE_TOKEN =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)/g;

const commentMarker = (language: string) => {
  if (/^(py|python|ruby|rb|sh|bash|shell|yaml|yml|r)$/i.test(language))
    return "#";
  if (/sql/i.test(language)) return "--";
  return "//";
};

// Splits a line into code and a trailing comment (ignores markers in strings).
const splitComment = (line: string, marker: string): [string, string] => {
  let quote: string | null = null;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (line.startsWith(marker, i)) {
      return [line.slice(0, i), line.slice(i)];
    }
  }

  return [line, ""];
};

type Token = { text: string; color: string };

const tokenizeLine = (line: string, marker: string): Token[] => {
  const [code, comment] = splitComment(line, marker);
  const tokens: Token[] = [];
  const pattern = new RegExp(CODE_TOKEN.source, "g");

  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(code);

  while (match) {
    const text = match[0];

    if (match.index > last) {
      tokens.push({ text: code.slice(last, match.index), color: C.codeText });
    }

    let color = C.codeText;
    if (match[1]) color = C.codeString;
    else if (match[2]) color = C.codeNumber;
    else if (match[3]) color = KEYWORDS.has(text) ? C.codeKeyword : C.codeFn;
    else if (match[4] && KEYWORDS.has(text)) color = C.codeKeyword;

    tokens.push({ text, color });
    last = match.index + text.length;
    match = pattern.exec(code);
  }

  if (last < code.length) {
    tokens.push({ text: code.slice(last), color: C.codeText });
  }
  if (comment) tokens.push({ text: comment, color: C.codeComment });

  return tokens;
};

const FILE_NAMES: Record<string, string> = {
  javascript: "script.js",
  js: "script.js",
  typescript: "index.ts",
  ts: "index.ts",
  python: "main.py",
  py: "main.py",
  java: "Main.java",
  c: "main.c",
  cpp: "main.cpp",
  sql: "query.sql",
  html: "index.html",
  css: "style.css",
  bash: "terminal",
  sh: "terminal",
};

const CodePanel: React.FC<{ scene: Scene; frames: number }> = ({
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

// ==================================================
// Scene layouts
// ==================================================

const Stack: React.FC<{ gap?: number; children: React.ReactNode }> = ({
  gap = 44,
  children,
}) => (
  <div
    style={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap,
    }}
  >
    {children}
  </div>
);

// Hook: Swiss kinetic typography + cartoon mascot.
const HookLayout: React.FC<{ scene: Scene }> = ({ scene }) => {
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

// Explanation: step-by-step flow diagram with drawn arrows.
const ExplanationLayout: React.FC<{ scene: Scene; frames: number }> = ({
  scene,
  frames,
}) => {
  const frame = useCurrentFrame();
  const points = getPoints(scene);
  const caption = getCaption(scene);

  if (points.length < 2) {
    return (
      <Stack>
        <Tag color={C.blue}>Concept</Tag>
        <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />
        <IdeaCard label="THE IDEA" text={caption} accent={C.blue} start={16} />
        <MascotSays mood="think" text="Keep this in mind!" delay={28} />
      </Stack>
    );
  }

  // Steps appear evenly through the scene instead of all at once.
  const step = Math.max(10, Math.min(28, (frames - 50) / points.length));

  return (
    <Stack gap={36}>
      <Tag color={C.blue}>Concept</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.8} delay={4} />

      <div style={{ width: "100%" }}>
        {points.map((point, i) => {
          const start = 18 + i * step;
          const color = pointColor(i, points.length);
          const isLast = i === points.length - 1;

          return (
            <React.Fragment key={`${i}-${point}`}>
              <Card background={isLast ? C.orangeSoft : C.white} start={start}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                    padding: "22px 30px",
                  }}
                >
                  <Badge color={color} label={String(i + 1)} />
                  <div
                    style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15 }}
                  >
                    {ellipsize(point, 50)}
                  </div>
                </div>
              </Card>
              {!isLast && <DrawArrow start={start + 12} />}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: C.subtle,
          textAlign: "center",
          lineHeight: 1.3,
          opacity: interpolate(
            frame,
            [18 + points.length * step, 30 + points.length * step],
            [0, 1],
            clamp,
          ),
        }}
      >
        {ellipsize(caption, 80)}
      </div>
    </Stack>
  );
};

// Code: real snippet from the script, highlighted line by line.
const CodeLayout: React.FC<{ scene: Scene; frames: number }> = ({
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

// Example: before/after (or problem/solution) comparison, or an analogy card.
const ExampleLayout: React.FC<{ scene: Scene }> = ({ scene }) => {
  const compare = scene.compare;

  if (!compare || !str(compare.left_text) || !str(compare.right_text)) {
    return (
      <Stack>
        <Tag color={C.teal}>Example</Tag>
        <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />
        <IdeaCard
          label="REAL-WORLD IDEA"
          text={getCaption(scene)}
          accent={C.teal}
          background={C.tealSoft}
          start={16}
        />
        <MascotSays mood="happy" text="Makes sense, right?" delay={28} />
      </Stack>
    );
  }

  const side = (
    label: string,
    text: string,
    accent: string,
    soft: string,
    start: number,
  ) => {
    const mono = isCodey(text);
    const size = text.length <= 24 ? 46 : text.length <= 40 ? 38 : 32;

    return (
      <Card background={soft} start={start}>
        <div style={{ padding: "26px 34px 32px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 22px",
              borderRadius: 999,
              background: accent,
              border: `4px solid ${C.ink}`,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 3,
              color: C.ink,
              marginBottom: 18,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: mono ? FONT_MONO : FONT_SANS,
              fontSize: mono ? size - 6 : size,
              fontWeight: mono ? 700 : 800,
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {text}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Stack gap={34}>
      <Tag color={C.teal}>Example</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.8} delay={4} />
      <div style={{ width: "100%" }}>
        {side(
          str(compare.left_label) || "BEFORE",
          str(compare.left_text),
          C.coral,
          C.coralSoft,
          16,
        )}
        <div style={{ height: 14 }} />
        <DrawArrow start={42} />
        <div style={{ height: 14 }} />
        {side(
          str(compare.right_label) || "AFTER",
          str(compare.right_text),
          C.teal,
          C.tealSoft,
          58,
        )}
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: C.subtle,
          textAlign: "center",
        }}
      >
        {ellipsize(getCaption(scene), 80)}
      </div>
    </Stack>
  );
};

// Outro: recap checklist + subscribe button with a waving mascot.
const OutroLayout: React.FC<{
  scene: Scene;
  channelName: string;
  frames: number;
}> = ({ scene, channelName, frames }) => {
  const frame = useCurrentFrame();
  const points = getPoints(scene).slice(0, 3);
  const pulse = 1 + Math.sin(frame / 6) * 0.025;

  const step = Math.max(
    10,
    Math.min(24, (frames - 60) / Math.max(1, points.length)),
  );

  return (
    <Stack gap={40}>
      <Tag color={C.orange}>{points.length ? "Recap" : "You made it!"}</Tag>
      <KineticTitle text={scene.on_screen_text} scale={0.85} delay={4} />

      {points.length > 0 ? (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {points.map((point, i) => (
            <Card key={`${i}-${point}`} start={16 + i * step}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  padding: "20px 30px",
                }}
              >
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 60 60"
                  style={{ flexShrink: 0 }}
                >
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    fill={C.teal}
                    stroke={C.ink}
                    strokeWidth="5"
                  />
                  <path
                    d="M17 31 L26 40 L43 21"
                    stroke={C.ink}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <div
                  style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}
                >
                  {ellipsize(point, 46)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <IdeaCard
          label="REMEMBER"
          text={getCaption(scene)}
          accent={C.orange}
          start={16}
        />
      )}

      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 34,
        }}
      >
        <Mascot mood="wave" size={210} delay={30} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "26px 48px",
              borderRadius: 999,
              background: C.orange,
              border: `5px solid ${C.ink}`,
              boxShadow: `8px 8px 0 ${C.ink}`,
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: 3,
              transform: `scale(${pulse})`,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40">
              <path
                d="M10 6 L34 20 L10 34 Z"
                fill={C.ink}
                strokeLinejoin="round"
                stroke={C.ink}
                strokeWidth="4"
              />
            </svg>
            SUBSCRIBE
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 4,
              color: C.ink,
              textTransform: "uppercase",
            }}
          >
            {channelName}
          </div>
        </div>
      </div>
    </Stack>
  );
};

// ==================================================
// Scene shell: safe-area box, entrance and exit
// ==================================================

const SceneShell: React.FC<{ frames: number; children: React.ReactNode }> = ({
  frames,
  children,
}) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 6], [0, 1], clamp);
  const fadeOut = interpolate(frame, [frames - 8, frames], [1, 0], clamp);
  const rise = interpolate(frame, [0, 10], [36, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        top: 200,
        bottom: 330,
        left: 64,
        right: 64,
        width: "auto",
        height: "auto",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(fadeIn, fadeOut),
        transform: `translateY(${rise}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const SceneContent: React.FC<{
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

// ==================================================
// Video composition
// ==================================================

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
