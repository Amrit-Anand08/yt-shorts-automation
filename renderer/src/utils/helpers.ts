import { CalculateMetadataFunction, spring, useCurrentFrame } from "remotion";
import { Scene, SceneType, Token, VideoProps } from "../types";
import { C, FPS } from "../constants/tokens";
import { KEYWORDS } from "../constants/defaults";

// ==================================================
// Timing: integer frame boundaries (no fractional frames)
// ==================================================

export const sceneSeconds = (scene: Scene) =>
  Math.max(1, Number(scene.duration) || 1);

// boundaries[i] is the first frame of scene i; the last entry is the total.
// Rounding is done on the running total, so scenes never drift from the audio,
// and the last boundary is rounded UP so the narration is never cut off.
export const getSceneBoundaries = (scenes: Scene[]): number[] => {
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

export const getDurationInFrames = (scenes: Scene[]) => {
  const boundaries = getSceneBoundaries(scenes);
  return Math.max(1, boundaries[boundaries.length - 1]);
};

export const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({
  props,
}) => ({
  durationInFrames: getDurationInFrames(props.scenes),
});

// ==================================================
// Text helpers
// ==================================================

export const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const ellipsize = (text: string, max: number) => {
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");

  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
};

export const firstSentence = (text: string) => {
  const clean = str(text);
  const match = clean.match(/^.*?[.!?।](\s|$)/);

  return (match ? match[0] : clean).trim();
};

// Caption shown on screen. Never the director note (visual_description).
export const getCaption = (scene: Scene) =>
  str(scene.caption) || ellipsize(firstSentence(scene.voiceover), 100);

export const getPoints = (scene: Scene): string[] =>
  Array.isArray(scene.points)
    ? scene.points.map(str).filter(Boolean).slice(0, 4)
    : [];

export const isCodey = (text: string) =>
  /[{};=<>]|=>|\(\)|\w\(.*\)|\[.*\]/.test(text);

export const onColor = (background: string) =>
  background === C.blue ? C.white : C.ink;

// Blue = start / data, teal = process, orange = the key insight at the end.
export const pointColor = (index: number, count: number) => {
  if (count > 1 && index === count - 1) return C.orange;
  return index === 0 ? C.blue : C.teal;
};

export const inferSceneType = (
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
export const usePop = (delay = 0) => {
  const frame = useCurrentFrame();

  return spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: { damping: 13, stiffness: 170, mass: 0.7 },
  });
};

// ==================================================
// Code syntax helpers
// ==================================================

const CODE_TOKEN =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)/g;

export const commentMarker = (language: string) => {
  if (/^(py|python|ruby|rb|sh|bash|shell|yaml|yml|r)$/i.test(language))
    return "#";
  if (/sql/i.test(language)) return "--";
  return "//";
};

// Splits a line into code and a trailing comment (ignores markers in strings).
export const splitComment = (line: string, marker: string): [string, string] => {
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

export const tokenizeLine = (line: string, marker: string): Token[] => {
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

    let color: string = C.codeText;
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
