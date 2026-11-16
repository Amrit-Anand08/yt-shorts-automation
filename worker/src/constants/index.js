const SCENE_TYPES = new Set([
  "hook",
  "explanation",
  "code",
  "example",
  "outro",
]);

// One sound effect per scene type (files live in the renderer's public/audio/sfx).
const SFX_BY_TYPE = {
  hook: "audio/sfx/impact.wav",
  explanation: "audio/sfx/whoosh.wav",
  code: "audio/sfx/click.wav",
  example: "audio/sfx/pop.wav",
  outro: "audio/sfx/pop.wav",
};

const TAIL_SECONDS = 0.6;

module.exports = {
  SCENE_TYPES,
  SFX_BY_TYPE,
  TAIL_SECONDS,
};
