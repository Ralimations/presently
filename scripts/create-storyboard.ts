import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {generateStoryboard} from "../src/storyboard/generateStoryboard";
import {
  aspectRatios,
  backgroundTypes,
  cameraMoves,
  cameraFocuses,
  cameraIntensities,
  fontFamilies,
  headlineSizes,
  headlineWeights,
  layoutModes,
  motionTypes,
  textTransforms,
  transitionTypes,
  ttsVoices,
  visualTypes,
  validateStoryboard,
  type AspectRatio,
  type Storyboard,
  type Tone,
} from "../src/storyboard/schema";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const outputPath = args.get("out") ?? "output/storyboards/storyboard.json";
const input = {
  topic: args.get("topic") ?? "AI-generated one-minute explainers",
  audience: args.get("audience") ?? "founders and content teams",
  tone: (args.get("tone") ?? "bold") as Tone,
  aspectRatio: (args.get("aspect") ?? "16:9") as AspectRatio,
  sources: args.get("sources") ?? "",
  speechVoice: (args.get("voice") ?? "af_heart") as Storyboard["speechVoice"],
};
const provider = args.get("llm-provider") ?? "mock";
const ollamaUrl = args.get("ollama-url") ?? "http://localhost:11434";
const ollamaModel = args.get("ollama-model") ?? "qwen2.5:7b";

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------
const fallbackStoryboard = generateStoryboard(input);

// ---------------------------------------------------------------------------
// LLM Prompt builder
// ---------------------------------------------------------------------------
const enumList = (values: readonly string[]) =>
  values.map((v) => `"${v}"`).join(", ");

const buildPrompt = () => `
You are a creative director, motion designer, and writer. Your task is to generate a complete JSON storyboard for a 60-second Remotion infographic video.

You have FULL CREATIVE CONTROL. You decide:
- The exact colors (hex codes) for backgrounds, text, accents
- The layout arrangement of each scene  
- The typography style and size
- The visual element type (chart, stat, diagram, etc.)
- What the TTS narrator says for each scene
- The music genre, mood, instruments, and energy arc

STRICT RULES:
1. Return ONLY a single JSON object. No markdown. No explanations. No commentary.
2. Total scene durations must add up to EXACTLY 60 seconds.
3. Use 6 scenes with durations that sum to 60 (suggested: 9, 9, 10, 10, 10, 12).
4. Every narration must fit comfortably when spoken aloud within the scene duration (roughly 2-3 words per second).
5. Only use values from the allowed enums listed below.
6. Invent only facts and statistics that are plausible; prefer directional claims over hard numbers.
7. CRITICAL: In the \`headline\` field, you MUST wrap the 1-3 most important words in asterisks (e.g. "The *rise of quantum* computing"). The renderer will use these to isolate and highlight key information.
8. The video is for: ${input.audience}
9. The topic is: ${input.topic}
10. Tone directive: ${input.tone}
11. Aspect ratio: ${input.aspectRatio}
${input.sources ? `12. Use these notes as grounding context:\n${input.sources}` : ""}

ALLOWED ENUM VALUES:
- fontFamily: ${enumList(fontFamilies)}
- backgroundStyle.type: ${enumList(backgroundTypes)}
- visualType (per scene): ${enumList(visualTypes)}
- layoutMode (per scene): ${enumList(layoutModes)}
- motion (per scene): ${enumList(motionTypes)}
- camera.move: ${enumList(cameraMoves)}
- camera.focus: ${enumList(cameraFocuses)}
- camera.intensity: ${enumList(cameraIntensities)}
- transition: ${enumList(transitionTypes)}
- accentShape: "circle", "triangle", "star", "none"
- accentPosition: "top-right", "bottom-left", "center-bg", "none"
- typography.headlineSize: ${enumList(headlineSizes)}
- typography.headlineWeight: ${enumList(headlineWeights)}
- typography.headlineTransform: ${enumList(textTransforms)}
- typography.bodySize: "sm", "md", "lg"
- speechVoice: ${enumList(ttsVoices)}

COMPLETE JSON SHAPE — fill every field:
{
  "title": "Short punchy video title (max 80 chars)",
  "topic": "${input.topic}",
  "audience": "${input.audience}",
  "tone": "${input.tone}",
  "aspectRatio": "${input.aspectRatio}",
  "fontFamily": "grotesk",
  "globalBackground": {
    "type": "radial",
    "primary": "#0d1117",
    "secondary": "#1c2333",
    "angle": 135
  },
  "palette": {
    "background": "#0d1117",
    "foreground": "#f0e6d3",
    "accent": "#ffb800",
    "secondary": "#5b8dee"
  },
  "musicPrompt": "Detailed music description: genre, BPM range, instruments, mood, energy arc over 60 seconds (max 280 chars)",
  "speechVoice": "af_heart",
  "scenes": [
    {
      "id": "hook",
      "visualType": "hero-stat",
      "layoutMode": "centered",
      "motion": "zoom",
      "camera": {"move": "push-in", "focus": "center", "intensity": "medium"},
      "transition": "iris",
      "accentShape": "circle",
      "accentPosition": "top-right",
      "backgroundStyle": {
        "type": "radial",
        "primary": "#0d1117",
        "secondary": "#1c2333"
      },
      "typography": {
        "headlineSize": "display",
        "headlineWeight": "900",
        "headlineTransform": "uppercase",
        "bodySize": "lg"
      },
      "durationSeconds": 9,
      "eyebrow": "Scene label (max 36 chars)",
      "headline": "Punchy scene headline with *critical words* highlighted (max 72 chars)",
      "body": "Two-sentence scene body copy that supports the headline (max 190 chars)",
      "stat": "Optional big number or word",
      "narration": "What the TTS voice reads aloud for this scene. Should be 20-40 words and feel natural when spoken.",
      "keywords": ["word1", "word2", "word3"],
      "chartData": [
        {"label": "Category A", "value": 72},
        {"label": "Category B", "value": 45}
      ],
      "compare": {"left": "Old approach", "right": "New approach"}
    }
  ]
}

Design guidance:
- Make the color palette visually striking and cohesive. Dark backgrounds work well for bold/cinematic tones. Light backgrounds for academic/clear.
- Vary the layoutMode across scenes so the video feels dynamic.
- The narration should tell a clear narrative arc: hook → context → contrast → mechanism → evidence → takeaway.
- The musicPrompt should match the tone and energy. Be specific: e.g., "ambient electronic with building tension at 88BPM, piano motif, subtle percussion, peaks at 0:45 then resolves gently".
- Choose accentShape and accentPosition to add visual interest without cluttering the frame.

Return the JSON object now:
`;

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------
const extractJsonObject = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }

  return candidate.slice(start, end + 1);
};

// ---------------------------------------------------------------------------
// Ollama call
// ---------------------------------------------------------------------------
const generateWithOllama = async (): Promise<Storyboard> => {
  const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      model: ollamaModel,
      prompt: buildPrompt(),
      stream: false,
      format: "json",
      options: {
        temperature: 0.45,
        num_ctx: 8192,
        top_p: 0.9,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {response?: string};
  const rawJson = extractJsonObject(data.response ?? "");

  try {
    return validateStoryboard(JSON.parse(rawJson));
  } catch (validationError) {
    // Attempt to patch common LLM mistakes before giving up
    const parsed = JSON.parse(rawJson);

    // Fix total duration if LLM got it wrong
    if (Array.isArray(parsed.scenes)) {
      const total = parsed.scenes.reduce(
        (sum: number, s: {durationSeconds?: number}) => sum + (s.durationSeconds ?? 0),
        0,
      );
      if (total !== 60 && parsed.scenes.length === 6) {
        // Adjust last scene to make total 60
        const rest = parsed.scenes.slice(0, -1).reduce(
          (sum: number, s: {durationSeconds?: number}) => sum + (s.durationSeconds ?? 0),
          0,
        );
        parsed.scenes[parsed.scenes.length - 1].durationSeconds = 60 - rest;
      }
    }

    return validateStoryboard(parsed);
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const createStoryboard = async (): Promise<Storyboard> => {
  if (provider !== "ollama") {
    console.log(`Provider: ${provider}. Using built-in deterministic storyboard.`);
    return fallbackStoryboard;
  }

  try {
    console.log(`Calling Ollama model: ${ollamaModel} at ${ollamaUrl} …`);
    const storyboard = await generateWithOllama();
    console.log(`LLM storyboard generated with ${ollamaModel}.`);
    return storyboard;
  } catch (error) {
    console.warn(
      `Ollama generation failed — using built-in fallback. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return fallbackStoryboard;
  }
};

const main = async () => {
  const storyboard = await createStoryboard();
  mkdirSync(dirname(outputPath), {recursive: true});
  writeFileSync(outputPath, `${JSON.stringify(storyboard, null, 2)}\n`);
  console.log(`Wrote validated storyboard → ${outputPath}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
