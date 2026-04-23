import {z} from "zod";

export const visualTypes = [
  "hero-stat",
  "timeline",
  "comparison",
  "process",
  "quote",
  "chart",
  "summary",
  "kinetic-text",
  "diagram",
  "stat-wall",
  "before-after",
  "myth-fact",
  "image-collage",
  "map",
] as const;

export const layoutTypes = [
  "split-card",
  "poster",
  "editorial",
  "dashboard",
  "stacked",
] as const;

export const motionTypes = [
  "rise",
  "slide-left",
  "zoom",
  "wipe",
  "drift",
] as const;

export const cameraMoves = [
  "static",
  "push-in",
  "pull-back",
  "pan-left",
  "pan-right",
  "tilt-up",
  "focus-pop",
  "orbit",
  "handheld",
] as const;

export const cameraFocuses = [
  "headline",
  "visual",
  "stat",
  "center",
  "left",
  "right",
] as const;

export const cameraIntensities = ["subtle", "medium", "strong"] as const;

export const transitionTypes = [
  "fade",
  "push",
  "iris",
  "wipe",
  "flip",
  "blur",
] as const;

export const artDirections = [
  "minimal",
  "editorial",
  "technical",
  "cinematic",
  "playful",
] as const;

export const fontPairs = [
  "grotesk-serif",
  "editorial-mono",
  "geometric-humanist",
  "cinematic-condensed",
  "technical-mono",
] as const;

export const textureTypes = [
  "clean",
  "grid",
  "grain",
  "contour",
  "orbits",
] as const;

export const templateTypes = [
  "briefing",
  "kinetic",
  "magazine",
  "product-demo",
  "data-room",
  "cinematic-essay",
] as const;

export const symbolNames = [
  "spark",
  "network",
  "leaf",
  "pulse",
  "map",
  "stack",
  "orbit",
  "signal",
  "prism",
  "wave",
  "target",
  "globe",
  "bolt",
] as const;

export const toneOptions = [
  "clear",
  "bold",
  "academic",
  "startup",
  "cinematic",
] as const;

export const aspectRatios = ["16:9", "9:16", "1:1"] as const;

export const refinedPromptSchema = z.object({
  userPrompt: z.string().min(2).max(600),
  sitePrompt: z.string().min(8).max(900),
  musicPrompt: z.string().min(8).max(300),
  renderBrief: z.string().min(8).max(500),
});

export const sceneSchema = z.object({
  id: z.string().min(2).max(40),
  visualType: z.enum(visualTypes),
  layout: z.enum(layoutTypes),
  motion: z.enum(motionTypes),
  camera: z.object({
    move: z.enum(cameraMoves),
    focus: z.enum(cameraFocuses),
    intensity: z.enum(cameraIntensities),
  }),
  transition: z.enum(transitionTypes),
  template: z.enum(templateTypes),
  symbol: z.enum(symbolNames),
  durationSeconds: z.number().int().min(6).max(14),
  eyebrow: z.string().min(2).max(36),
  headline: z.string().min(4).max(72),
  body: z.string().min(8).max(180),
  stat: z.string().max(32).optional(),
  chartData: z
    .array(
      z.object({
        label: z.string().min(1).max(18),
        value: z.number().min(0).max(100),
      }),
    )
    .min(2)
    .max(5)
    .optional(),
  keywords: z.array(z.string().min(1).max(18)).min(2).max(6).optional(),
  compare: z
    .object({
      left: z.string().min(2).max(44),
      right: z.string().min(2).max(44),
    })
    .optional(),
});

export const storyboardSchema = z.object({
  title: z.string().min(4).max(90),
  topic: z.string().min(2).max(120),
  audience: z.string().min(2).max(80),
  tone: z.enum(toneOptions),
  aspectRatio: z.enum(aspectRatios),
  artDirection: z.enum(artDirections),
  fontPair: z.enum(fontPairs),
  texture: z.enum(textureTypes),
  refinedPrompt: refinedPromptSchema,
  musicPrompt: z.string().min(8).max(180),
  palette: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  scenes: z.array(sceneSchema).min(5).max(8),
});

export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type Tone = (typeof toneOptions)[number];
export type AspectRatio = (typeof aspectRatios)[number];
export type LayoutType = (typeof layoutTypes)[number];
export type MotionType = (typeof motionTypes)[number];
export type CameraMove = (typeof cameraMoves)[number];
export type CameraFocus = (typeof cameraFocuses)[number];
export type CameraIntensity = (typeof cameraIntensities)[number];
export type TransitionType = (typeof transitionTypes)[number];
export type ArtDirection = (typeof artDirections)[number];
export type FontPair = (typeof fontPairs)[number];
export type TextureType = (typeof textureTypes)[number];
export type TemplateType = (typeof templateTypes)[number];
export type SymbolName = (typeof symbolNames)[number];

export const FPS = 30;
export const TARGET_DURATION_SECONDS = 60;
export const TARGET_DURATION_FRAMES = FPS * TARGET_DURATION_SECONDS;

export const validateStoryboard = (input: unknown): Storyboard => {
  const storyboard = storyboardSchema.parse(input);
  const totalSeconds = storyboard.scenes.reduce(
    (sum, scene) => sum + scene.durationSeconds,
    0,
  );

  if (totalSeconds !== TARGET_DURATION_SECONDS) {
    throw new Error(
      `Storyboard scenes must total ${TARGET_DURATION_SECONDS}s, got ${totalSeconds}s.`,
    );
  }

  return storyboard;
};

export const getDimensions = (aspectRatio: AspectRatio) => {
  if (aspectRatio === "9:16") {
    return {width: 1080, height: 1920};
  }

  if (aspectRatio === "1:1") {
    return {width: 1080, height: 1080};
  }

  return {width: 1920, height: 1080};
};
