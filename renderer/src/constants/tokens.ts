// ==================================================
// Design tokens: "Modern Cartoon Vector Motion Graphics"
// ==================================================

export const C = {
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
} as const;

// Two font families only. Add @remotion/google-fonts (Inter + JetBrains Mono)
// or bundle the files in /public to get exactly these fonts in the renderer;
// until then the system fallbacks below are used.
export const FONT_SANS = `"Geist", "Inter", "Manrope", "Segoe UI", Arial, Helvetica, sans-serif`;
export const FONT_MONO = `"JetBrains Mono", "IBM Plex Mono", "Fira Code", Menlo, Consolas, monospace`;

export const FPS = 30;

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
