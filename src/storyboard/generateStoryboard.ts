import {
  AspectRatio,
  BackgroundStyle,
  FontFamily,
  Storyboard,
  Tone,
  TtsVoice,
  type Scene,
  validateStoryboard,
} from "./schema";

export type StoryboardInput = {
  topic: string;
  audience: string;
  tone: Tone;
  aspectRatio: AspectRatio;
  sources?: string;
  speechVoice?: TtsVoice;
};

// ---------------------------------------------------------------------------
// Default palettes by tone
// ---------------------------------------------------------------------------
const paletteByTone: Record<Tone, Storyboard["palette"]> = {
  clear: {
    background: "#f4efe3",
    foreground: "#16201c",
    accent: "#db5c2f",
    secondary: "#2f6f73",
  },
  bold: {
    background: "#111217",
    foreground: "#f7f1df",
    accent: "#ffb000",
    secondary: "#ef476f",
  },
  academic: {
    background: "#ebe7dc",
    foreground: "#17233b",
    accent: "#315f72",
    secondary: "#8b5e34",
  },
  startup: {
    background: "#eff7f1",
    foreground: "#10231b",
    accent: "#0f9f6e",
    secondary: "#254bdd",
  },
  cinematic: {
    background: "#0d1117",
    foreground: "#f7edd2",
    accent: "#c88f32",
    secondary: "#386fa4",
  },
};

const fontByTone: Record<Tone, FontFamily> = {
  clear: "humanist",
  bold: "grotesk",
  academic: "serif",
  startup: "grotesk",
  cinematic: "condensed",
};

const globalBgByTone: Record<Tone, BackgroundStyle> = {
  clear: {type: "gradient", primary: "#f4efe3", secondary: "#e8e0cc", angle: 160},
  bold: {type: "radial", primary: "#111217", secondary: "#1c1f2e"},
  academic: {type: "noise-gradient", primary: "#ebe7dc", secondary: "#d8d0be", angle: 135},
  startup: {type: "gradient", primary: "#eff7f1", secondary: "#daf0e4", angle: 140},
  cinematic: {type: "radial", primary: "#0d1117", secondary: "#14202e"},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clampTopic = (topic: string) =>
  topic.trim().replace(/\s+/g, " ").slice(0, 110) || "an emerging idea";

const limitText = (text: string, maxLength: number) => {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 30 ? lastSpace : clipped.length).trim()}.`;
};

// ---------------------------------------------------------------------------
// Fallback storyboard (used when LLM is unavailable)
// ---------------------------------------------------------------------------
export const generateStoryboard = (input: StoryboardInput): Storyboard => {
  const topic = clampTopic(input.topic);
  const shortTopic = limitText(topic, 54);
  const audience = input.audience.trim() || "curious viewers";
  const palette = paletteByTone[input.tone];
  const fontFamily = fontByTone[input.tone];
  const globalBackground = globalBgByTone[input.tone];

  const musicPrompt = limitText(
    `${input.tone} instrumental bed for a one-minute explainer about ${topic}. No vocals, steady pacing, clean ending, subtle transitions every 9-12 seconds.`,
    280,
  );

  const scenes: Scene[] = [
    {
      id: "hook",
      visualType: "hero-stat",
      layoutMode: "centered",
      motion: "zoom",
      camera: {move: "push-in", focus: "center", intensity: "medium"},
      transition: "iris",
      accentShape: "circle",
      accentPosition: "top-right",
      typography: {headlineSize: "display", headlineWeight: "900", headlineTransform: "uppercase", bodySize: "lg"},
      durationSeconds: 9,
      eyebrow: "The Big Picture",
      headline: `Why ${shortTopic} matters now`,
      body: `Frame the topic for ${audience}: what changed, why it matters, and what to watch for.`,
      narration: `Here is why ${shortTopic} matters right now. Something shifted, and ${audience} needs to know about it.`,
      stat: "60 sec",
    },
    {
      id: "context",
      visualType: "timeline",
      layoutMode: "split-left",
      motion: "slide-left",
      camera: {move: "pan-left", focus: "visual", intensity: "subtle"},
      transition: "push",
      accentShape: "none",
      accentPosition: "none",
      typography: {headlineSize: "3xl", headlineWeight: "700", headlineTransform: "uppercase", bodySize: "md"},
      durationSeconds: 9,
      eyebrow: "Context",
      headline: "The shift did not happen overnight",
      body: `Show the before state, the inflection point, and the new reality created by ${shortTopic}.`,
      narration: `This did not happen overnight. Let us trace how ${shortTopic} evolved and what made the change inevitable.`,
      keywords: ["before", "turning point", "now"],
    },
    {
      id: "contrast",
      visualType: "comparison",
      layoutMode: "split-right",
      motion: "rise",
      camera: {move: "focus-pop", focus: "stat", intensity: "medium"},
      transition: "fade",
      accentShape: "triangle",
      accentPosition: "bottom-left",
      typography: {headlineSize: "3xl", headlineWeight: "700", headlineTransform: "uppercase", bodySize: "md"},
      durationSeconds: 10,
      eyebrow: "Contrast",
      headline: "Old model vs. new reality",
      body: `Compare the familiar assumption against the more useful way to understand ${shortTopic} today.`,
      narration: `The old model said one thing. The new reality says another. Here is the contrast that matters most.`,
      compare: {left: "Old model", right: "New reality"},
    },
    {
      id: "mechanism",
      visualType: "diagram",
      layoutMode: "split-left",
      motion: "wipe",
      camera: {move: "tilt-up", focus: "headline", intensity: "subtle"},
      transition: "wipe",
      accentShape: "circle",
      accentPosition: "center-bg",
      typography: {headlineSize: "2xl", headlineWeight: "700", headlineTransform: "uppercase", bodySize: "md"},
      durationSeconds: 10,
      eyebrow: "Mechanism",
      headline: "Three moves create the outcome",
      body: "Input becomes signal. Signal drives a decision. Decision compounds into visible results.",
      narration: "The system works in three moves. Input generates a signal, the signal drives a decision, and decisions compound into real outcomes.",
      keywords: ["input", "signal", "decision"],
    },
    {
      id: "evidence",
      visualType: "bar-chart",
      layoutMode: "data-focus",
      motion: "drift",
      camera: {move: "orbit", focus: "visual", intensity: "subtle"},
      transition: "blur",
      accentShape: "none",
      accentPosition: "none",
      typography: {headlineSize: "2xl", headlineWeight: "700", headlineTransform: "uppercase", bodySize: "sm"},
      durationSeconds: 10,
      eyebrow: "Evidence",
      headline: "Look for directional proof",
      body: "Use credible signals — adoption, cost, speed, trust — before making strong claims.",
      narration: "Before accepting any claim, look for directional proof. Adoption, cost savings, speed, and trust are the right signals to watch.",
      chartData: [
        {label: "Reach", value: 64},
        {label: "Speed", value: 82},
        {label: "Cost", value: 48},
        {label: "Trust", value: 70},
      ],
    },
    {
      id: "takeaway",
      visualType: "kinetic-text",
      layoutMode: "fullscreen-text",
      motion: "rise",
      camera: {move: "pull-back", focus: "center", intensity: "medium"},
      transition: "flip",
      accentShape: "star",
      accentPosition: "top-right",
      typography: {headlineSize: "4xl", headlineWeight: "900", headlineTransform: "uppercase", bodySize: "lg"},
      durationSeconds: 12,
      eyebrow: "Takeaway",
      headline: "The practical read",
      body: `${shortTopic} is clearest when the story moves from why now, to how it works, to what action ${audience} should take.`,
      narration: `To sum up: ${shortTopic} is real, it is happening now, and ${audience} should know exactly what to do next.`,
      stat: "3 ideas",
      keywords: ["why now", "how it works", "act"],
    },
  ];

  return validateStoryboard({
    title: `${shortTopic}: the one-minute briefing`,
    topic,
    audience,
    tone: input.tone,
    aspectRatio: input.aspectRatio,
    fontFamily,
    globalBackground,
    palette,
    musicPrompt,
    speechVoice: input.speechVoice ?? "af_heart",
    scenes,
  });
};

export type {StoryboardInput as default};
