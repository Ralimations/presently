import {
  ArtDirection,
  AspectRatio,
  CameraFocus,
  CameraIntensity,
  CameraMove,
  FontPair,
  LayoutType,
  MotionType,
  Storyboard,
  SymbolName,
  TemplateType,
  TextureType,
  Tone,
  TransitionType,
  type Scene,
  validateStoryboard,
} from "./schema";

export type StoryboardInput = {
  topic: string;
  audience: string;
  tone: Tone;
  aspectRatio: AspectRatio;
  sources?: string;
};

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

const clampTopic = (topic: string) =>
  topic.trim().replace(/\s+/g, " ").slice(0, 110) || "an emerging idea";

const artDirectionByTone: Record<Tone, ArtDirection> = {
  clear: "minimal",
  bold: "editorial",
  academic: "technical",
  startup: "playful",
  cinematic: "cinematic",
};

const fontPairByTone: Record<Tone, FontPair> = {
  clear: "geometric-humanist",
  bold: "grotesk-serif",
  academic: "editorial-mono",
  startup: "grotesk-serif",
  cinematic: "cinematic-condensed",
};

const textureByTone: Record<Tone, TextureType> = {
  clear: "clean",
  bold: "grain",
  academic: "grid",
  startup: "orbits",
  cinematic: "contour",
};

const layoutSequence: LayoutType[] = [
  "poster",
  "editorial",
  "split-card",
  "stacked",
  "dashboard",
  "poster",
];

const motionSequence: MotionType[] = [
  "zoom",
  "slide-left",
  "rise",
  "wipe",
  "drift",
  "rise",
];

const cameraMoveSequence: CameraMove[] = [
  "push-in",
  "pan-left",
  "focus-pop",
  "tilt-up",
  "orbit",
  "pull-back",
];

const cameraFocusSequence: CameraFocus[] = [
  "headline",
  "visual",
  "stat",
  "center",
  "right",
  "center",
];

const cameraIntensityByTone: Record<Tone, CameraIntensity> = {
  clear: "subtle",
  bold: "medium",
  academic: "subtle",
  startup: "medium",
  cinematic: "strong",
};

const transitionSequence: TransitionType[] = [
  "iris",
  "push",
  "fade",
  "wipe",
  "blur",
  "flip",
];

const templateSequence: TemplateType[] = [
  "briefing",
  "magazine",
  "data-room",
  "product-demo",
  "kinetic",
  "cinematic-essay",
];

const symbolSequence: SymbolName[] = [
  "spark",
  "map",
  "network",
  "stack",
  "signal",
  "prism",
];

const defaultVisualSequence: Scene["visualType"][] = [
  "hero-stat",
  "timeline",
  "comparison",
  "process",
  "chart",
  "summary",
];

const extendedVisualSequence: Scene["visualType"][] = [
  "kinetic-text",
  "map",
  "myth-fact",
  "diagram",
  "stat-wall",
  "before-after",
];

const pickVisualSequence = (input: StoryboardInput): Scene["visualType"][] => {
  const prompt = `${input.topic} ${input.sources ?? ""}`.toLowerCase();

  if (
    prompt.includes("map") ||
    prompt.includes("city") ||
    prompt.includes("urban") ||
    prompt.includes("global") ||
    prompt.includes("where")
  ) {
    return ["hero-stat", "map", "diagram", "before-after", "stat-wall", "summary"];
  }

  if (
    prompt.includes("myth") ||
    prompt.includes("debunk") ||
    prompt.includes("misconception")
  ) {
    return ["kinetic-text", "myth-fact", "comparison", "diagram", "quote", "summary"];
  }

  if (input.tone === "cinematic" || input.tone === "bold") {
    return extendedVisualSequence;
  }

  return defaultVisualSequence;
};

export const refinePrompt = (input: StoryboardInput) => {
  const topic = clampTopic(input.topic);
  const audience = input.audience.trim() || "curious viewers";
  const sourceDirection = input.sources?.trim()
    ? "Use the provided notes as grounding context without overloading the visuals."
    : "Use general explanatory framing and avoid unsupported hard statistics.";
  const artDirection = artDirectionByTone[input.tone];
  const sitePrompt = [
    `Create a 60-second ${input.aspectRatio} ${artDirection} infographic video site about ${topic}.`,
    `Audience: ${audience}. Tone: ${input.tone}.`,
    "Build it as six distinct pages with different layouts, clear transitions, sparse copy, and one visual argument per page.",
    sourceDirection,
  ].join(" ");
  const musicPrompt = [
    `${input.tone} instrumental bed for a one-minute explainer about ${topic}.`,
    "No vocals, steady pacing, subtle transitions every 9-12 seconds, clean ending.",
  ].join(" ");

  return {
    userPrompt: input.sources?.trim() || input.topic,
    sitePrompt,
    musicPrompt,
    renderBrief:
      "Render the trusted Remotion block plan to MP4, align scene transitions to the music bed, and keep total duration at exactly 60 seconds.",
  };
};

export const generateStoryboard = (input: StoryboardInput): Storyboard => {
  const topic = clampTopic(input.topic);
  const audience = input.audience.trim() || "curious viewers";
  const context = input.sources?.trim()
    ? ` using the provided source context`
    : "";
  const refinedPrompt = refinePrompt(input);
  const visualSequence = pickVisualSequence(input);

  return validateStoryboard({
    title: `${topic}: the one-minute briefing`,
    topic,
    audience,
    tone: input.tone,
    aspectRatio: input.aspectRatio,
    artDirection: artDirectionByTone[input.tone],
    fontPair: fontPairByTone[input.tone],
    texture: textureByTone[input.tone],
    refinedPrompt,
    musicPrompt: refinedPrompt.musicPrompt,
    palette: paletteByTone[input.tone],
    scenes: [
      {
        id: "hook",
        visualType: visualSequence[0],
        layout: layoutSequence[0],
        motion: motionSequence[0],
        camera: {
          move: cameraMoveSequence[0],
          focus: cameraFocusSequence[0],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[0],
        template: templateSequence[0],
        symbol: symbolSequence[0],
        durationSeconds: 9,
        eyebrow: "The hook",
        headline: `Why ${topic} matters now`,
        body: `Frame the topic for ${audience}${context}: what changed, why it is urgent, and what viewers should watch next.`,
        stat: "60 sec",
        keywords: ["why now", "signal", "stakes"],
      },
      {
        id: "context",
        visualType: visualSequence[1],
        layout: layoutSequence[1],
        motion: motionSequence[1],
        camera: {
          move: cameraMoveSequence[1],
          focus: cameraFocusSequence[1],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[1],
        template: templateSequence[1],
        symbol: symbolSequence[1],
        durationSeconds: 9,
        eyebrow: "Context",
        headline: "The shift did not happen overnight",
        body: `Show the before state, the inflection point, and the new behavior or opportunity created by ${topic}.`,
        keywords: ["before", "turning point", "now"],
      },
      {
        id: "contrast",
        visualType: visualSequence[2],
        layout: layoutSequence[2],
        motion: motionSequence[2],
        camera: {
          move: cameraMoveSequence[2],
          focus: cameraFocusSequence[2],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[2],
        template: templateSequence[2],
        symbol: symbolSequence[2],
        durationSeconds: 10,
        eyebrow: "Contrast",
        headline: "Old model vs. new reality",
        body: `Compare the familiar assumption against the more useful way to understand ${topic} today.`,
        chartData: [
          {label: "Old", value: 42},
          {label: "New", value: 78},
        ],
        compare: {
          left: "Old model",
          right: "New reality",
        },
      },
      {
        id: "mechanism",
        visualType: visualSequence[3],
        layout: layoutSequence[3],
        motion: motionSequence[3],
        camera: {
          move: cameraMoveSequence[3],
          focus: cameraFocusSequence[3],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[3],
        template: templateSequence[3],
        symbol: symbolSequence[3],
        durationSeconds: 10,
        eyebrow: "Mechanism",
        headline: "The system works in three moves",
        body: "Input becomes signal, signal drives a decision, and the decision compounds into visible outcomes.",
        keywords: ["input", "signal", "decision"],
      },
      {
        id: "proof",
        visualType: visualSequence[4],
        layout: layoutSequence[4],
        motion: motionSequence[4],
        camera: {
          move: cameraMoveSequence[4],
          focus: cameraFocusSequence[4],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[4],
        template: templateSequence[4],
        symbol: symbolSequence[4],
        durationSeconds: 10,
        eyebrow: "Evidence",
        headline: "Look for directional proof",
        body: "Use credible metrics, adoption patterns, or operational signals before making a strong claim.",
        chartData: [
          {label: "Reach", value: 64},
          {label: "Speed", value: 82},
          {label: "Cost", value: 48},
          {label: "Trust", value: 70},
        ],
        keywords: ["reach", "speed", "cost", "trust"],
      },
      {
        id: "takeaway",
        visualType: visualSequence[5],
        layout: layoutSequence[5],
        motion: motionSequence[5],
        camera: {
          move: cameraMoveSequence[5],
          focus: cameraFocusSequence[5],
          intensity: cameraIntensityByTone[input.tone],
        },
        transition: transitionSequence[5],
        template: templateSequence[5],
        symbol: symbolSequence[5],
        durationSeconds: 12,
        eyebrow: "Takeaway",
        headline: "The practical read",
        body: `${topic} is easiest to explain when the story moves from why now, to how it works, to what action ${audience} should take.`,
        stat: "3 ideas",
        keywords: ["why now", "how it works", "what to do"],
      },
    ],
  });
};
