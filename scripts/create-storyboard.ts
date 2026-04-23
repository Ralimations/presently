import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {generateStoryboard} from "../src/storyboard/generateStoryboard";
import {
  artDirections,
  aspectRatios,
  cameraFocuses,
  cameraIntensities,
  cameraMoves,
  fontPairs,
  layoutTypes,
  motionTypes,
  symbolNames,
  templateTypes,
  textureTypes,
  toneOptions,
  transitionTypes,
  validateStoryboard,
  visualTypes,
  type AspectRatio,
  type Storyboard,
  type Tone,
} from "../src/storyboard/schema";

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
};
const provider = args.get("llm-provider") ?? "mock";
const ollamaUrl = args.get("ollama-url") ?? "http://localhost:11434";
const ollamaModel = args.get("ollama-model") ?? "qwen3:0.6b";

const fallbackStoryboard = generateStoryboard(input);

const enumList = (values: readonly string[]) => values.map((value) => `"${value}"`).join(", ");

const buildPrompt = () => `
You generate validated JSON for a Remotion one-minute infographic video.
Return only one JSON object. Do not wrap it in markdown. Do not add commentary.

Required exact constraints:
- Duration must be exactly 60 seconds.
- Use 6 scenes with durations [9, 9, 10, 10, 10, 12].
- Keep all text concise.
- Use only allowed enum values.
- Do not invent unsupported hard statistics unless the user provided them.

User request:
${input.sources || input.topic}

Defaults:
- topic: ${input.topic}
- audience: ${input.audience}
- tone: ${input.tone}
- aspectRatio: ${input.aspectRatio}

Allowed values:
- tone: ${enumList(toneOptions)}
- aspectRatio: ${enumList(aspectRatios)}
- artDirection: ${enumList(artDirections)}
- fontPair: ${enumList(fontPairs)}
- texture: ${enumList(textureTypes)}
- visualType: ${enumList(visualTypes)}
- layout: ${enumList(layoutTypes)}
- motion: ${enumList(motionTypes)}
- camera.move: ${enumList(cameraMoves)}
- camera.focus: ${enumList(cameraFocuses)}
- camera.intensity: ${enumList(cameraIntensities)}
- transition: ${enumList(transitionTypes)}
- template: ${enumList(templateTypes)}
- symbol: ${enumList(symbolNames)}

Shape:
{
  "title": "string",
  "topic": "string",
  "audience": "string",
  "tone": "${input.tone}",
  "aspectRatio": "${input.aspectRatio}",
  "artDirection": "minimal|editorial|technical|cinematic|playful",
  "fontPair": "allowed value",
  "texture": "allowed value",
  "refinedPrompt": {
    "userPrompt": "string",
    "sitePrompt": "string",
    "musicPrompt": "string",
    "renderBrief": "string"
  },
  "musicPrompt": "string",
  "palette": {
    "background": "#000000",
    "foreground": "#ffffff",
    "accent": "#ffb000",
    "secondary": "#386fa4"
  },
  "scenes": [
    {
      "id": "hook",
      "visualType": "allowed value",
      "layout": "allowed value",
      "motion": "allowed value",
      "camera": {"move": "allowed value", "focus": "allowed value", "intensity": "allowed value"},
      "transition": "allowed value",
      "template": "allowed value",
      "symbol": "allowed value",
      "durationSeconds": 9,
      "eyebrow": "string",
      "headline": "string",
      "body": "string",
      "stat": "optional string",
      "keywords": ["2 to 6 short strings"],
      "chartData": [{"label": "short", "value": 50}],
      "compare": {"left": "string", "right": "string"}
    }
  ]
}
`;

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
        temperature: 0.35,
        num_ctx: 8192,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = (await response.json()) as {response?: string};
  const rawJson = extractJsonObject(data.response ?? "");
  return validateStoryboard(JSON.parse(rawJson));
};

const createStoryboard = async () => {
  if (provider !== "ollama") {
    return fallbackStoryboard;
  }

  try {
    const storyboard = await generateWithOllama();
    console.log(`Generated storyboard with Ollama model ${ollamaModel}`);
    return storyboard;
  } catch (error) {
    console.warn(
      `Ollama generation failed; using fallback storyboard. ${
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
  console.log(`Wrote validated storyboard to ${outputPath}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
