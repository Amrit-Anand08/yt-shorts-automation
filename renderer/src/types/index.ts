export type SceneType = "hook" | "explanation" | "code" | "example" | "outro";

export type Compare = {
  left_label?: string;
  left_text: string;
  right_label?: string;
  right_text: string;
};

export type Scene = {
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

export type VideoProps = {
  topic: string;
  channelName: string;
  scenes: Scene[];
  audioFile: string;
  musicFile: string;
};

export type Mood = "wow" | "think" | "happy" | "wave";

export type Token = {
  text: string;
  color: string;
};
