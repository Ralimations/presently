import {z} from "zod";

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Transitions & Motion
// ---------------------------------------------------------------------------
export const transitionTypes = [
  "fade",
  "push",
  "iris",
  "wipe",
  "flip",
  "blur",
] as const;

export const motionTypes = [
  "rise",
  "slide-left",
  "zoom",
  "wipe",
  "drift",
] as const;

// ---------------------------------------------------------------------------
// Visual Element type
// (No templates – LLM picks what data visual to show)
// ---------------------------------------------------------------------------
export const visualTypes = [
  "hero-stat",      // giant number / word centre stage
  "bar-chart",      // animated horizontal bars
  "timeline",       // numbered step sequence
  "comparison",     // side-by-side two panels
  "kinetic-text",   // word cloud / pill typography explosion
  "diagram",        // node-and-connector grid
  "stat-wall",      // 2×2 number tiles
  "quote",          // large pull-quote
  "none",           // full-bleed type only, no visual element
] as const;

// ---------------------------------------------------------------------------
// Layout modes (LLM-directed, no hardcoded templates)
// ---------------------------------------------------------------------------
export const layoutModes = [
  "centered",        // headline + visual centred, full width
  "split-left",      // text left 45 %, visual right 55 %
  "split-right",     // visual left 55 %, text right 45 %
  "fullscreen-text", // type fills the frame, visual hidden
  "data-focus",      // visual takes 65 %, text small
  "asymmetric",      // text anchored bottom-left, visual top-right
] as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
export const headlineSizes = ["xl", "2xl", "3xl", "4xl", "display"] as const;
export const headlineWeights = ["400", "600", "700", "900"] as const;
export const textTransforms = ["none", "uppercase", "lowercase"] as const;
export const bodySizes = ["sm", "md", "lg"] as const;

// ---------------------------------------------------------------------------
// Background styles (LLM sets colors directly)
// ---------------------------------------------------------------------------
export const backgroundTypes = [
  "solid",
  "gradient",
  "radial",
  "noise-gradient",
] as const;

// ---------------------------------------------------------------------------
// Accent shapes (purely decorative backdrop element)
// ---------------------------------------------------------------------------
export const accentShapes = ["circle", "triangle", "star", "none"] as const;
export const accentPositions = [
  "top-right",
  "bottom-left",
  "center-bg",
  "none",
] as const;

// ---------------------------------------------------------------------------
// Font families
// ---------------------------------------------------------------------------
export const fontFamilies = [
  "grotesk",    // Space Grotesk – clean modern sans
  "serif",      // Newsreader + Playfair – editorial
  "mono",       // JetBrains Mono – technical
  "condensed",  // Oswald – cinematic impact
  "humanist",   // Archivo – warm approachable
] as const;

// ---------------------------------------------------------------------------
// TTS voices (Kokoro)
// ---------------------------------------------------------------------------
export const ttsVoices = [
  "af_heart",    // American female – warm
  "af_bella",    // American female – bright
  "am_michael",  // American male – deep
  "af_sarah",    // American female – calm
] as const;

// ---------------------------------------------------------------------------
// Aspect ratios & tone
// ---------------------------------------------------------------------------
export const aspectRatios = ["16:9", "9:16", "1:1"] as const;

export const toneOptions = [
  "clear",
  "bold",
  "academic",
  "startup",
  "cinematic",
] as const;

// ---------------------------------------------------------------------------
// Hex colour validator
// ---------------------------------------------------------------------------
const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// Background style schema
// ---------------------------------------------------------------------------
export const backgroundStyleSchema = z.object({
  type: z.enum(backgroundTypes),
  primary: hexColour,
  secondary: hexColour.optional(),
  angle: z.number().min(0).max(360).optional(),
});

// ---------------------------------------------------------------------------
// Scene schema
// ---------------------------------------------------------------------------
export const sceneSchema = z.object({
  id: z.string().min(2).max(40),

  // Visual element
  visualType: z.enum(visualTypes),

  // LLM-directed layout (replaces hardcoded templates)
  layoutMode: z.enum(layoutModes),

  // Animations
  motion: z.enum(motionTypes),
  camera: z
    .object({
      move: z.enum(cameraMoves),
      focus: z.enum(cameraFocuses),
      intensity: z.enum(cameraIntensities),
    })
    .default({move: "push-in", focus: "center", intensity: "subtle"}),
  transition: z.enum(transitionTypes),

  // Per-scene background (overrides global palette if set)
  backgroundStyle: backgroundStyleSchema.optional(),

  // Decorative accent
  accentShape: z.enum(accentShapes).default("circle"),
  accentPosition: z.enum(accentPositions).default("top-right"),

  // Typography directives
  typography: z
    .object({
      headlineSize: z.enum(headlineSizes),
      headlineWeight: z.enum(headlineWeights),
      headlineTransform: z.enum(textTransforms).default("uppercase"),
      bodySize: z.enum(bodySizes),
    })
    .default({
      headlineSize: "3xl",
      headlineWeight: "900",
      headlineTransform: "uppercase",
      bodySize: "md",
    }),

  // Duration
  durationSeconds: z.number().int().min(6).max(14),

  // Copy
  eyebrow: z.string().min(2).max(40),
  headline: z.string().min(4).max(80),
  body: z.string().min(8).max(200),
  stat: z.string().max(36).optional(),

  // Narration text — spoken by TTS, synced to this scene's audio sequence
  narration: z.string().min(4).max(260),

  // Data
  chartData: z
    .array(
      z.object({
        label: z.string().min(1).max(20),
        value: z.number().min(0).max(100),
      }),
    )
    .min(2)
    .max(6)
    .optional(),
  keywords: z.array(z.string().min(1).max(20)).min(2).max(8).optional(),
  compare: z
    .object({
      left: z.string().min(2).max(50),
      right: z.string().min(2).max(50),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Storyboard schema
// ---------------------------------------------------------------------------
export const storyboardSchema = z.object({
  title: z.string().min(4).max(90),
  topic: z.string().min(2).max(120),
  audience: z.string().min(2).max(80),
  tone: z.enum(toneOptions),
  aspectRatio: z.enum(aspectRatios),

  // Global design tokens (LLM-controlled)
  fontFamily: z.enum(fontFamilies),
  globalBackground: backgroundStyleSchema,

  // Palette (drives CSS vars --bg, --fg, --accent, --secondary)
  palette: z.object({
    background: hexColour,
    foreground: hexColour,
    accent: hexColour,
    secondary: hexColour,
  }),

  // Music generation prompt (sent to MusicGen)
  musicPrompt: z.string().min(8).max(280),

  // TTS voice for all narration
  speechVoice: z.enum(ttsVoices).default("af_heart"),

  scenes: z.array(sceneSchema).min(5).max(8),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type Tone = (typeof toneOptions)[number];
export type AspectRatio = (typeof aspectRatios)[number];
export type LayoutMode = (typeof layoutModes)[number];
export type MotionType = (typeof motionTypes)[number];
export type CameraMove = (typeof cameraMoves)[number];
export type CameraFocus = (typeof cameraFocuses)[number];
export type CameraIntensity = (typeof cameraIntensities)[number];
export type TransitionType = (typeof transitionTypes)[number];
export type VisualType = (typeof visualTypes)[number];
export type FontFamily = (typeof fontFamilies)[number];
export type TtsVoice = (typeof ttsVoices)[number];
export type BackgroundStyle = z.infer<typeof backgroundStyleSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const FPS = 30;
export const TARGET_DURATION_SECONDS = 60;
export const TARGET_DURATION_FRAMES = FPS * TARGET_DURATION_SECONDS;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
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
