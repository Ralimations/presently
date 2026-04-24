import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {copyFile, mkdir, readFile, readdir, unlink, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer as createViteServer} from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeExecutable = process.execPath;
const port = Number(process.env.PRESENTLY_PORT ?? 5173);
const apiPort = Number(process.env.PRESENTLY_API_PORT ?? 8787);
const modelServerPort = Number(process.env.PRESENTLY_MODEL_SERVER_PORT ?? 8001);
const modelServerBase = `http://localhost:${modelServerPort}`;

const outputPaths = {
  storyboard: resolve(root, "output/storyboards/storyboard.json"),
  projects: resolve(root, "output/projects"),
  video: resolve(root, "public/output/videos/infographic.mp4"),
  still: resolve(root, "public/output/stills/frame.png"),
  thumbnails: resolve(root, "public/output/thumbnails"),
  music: resolve(root, "public/output/music/generated.wav"),
  musicFallback: resolve(root, "public/output/music/placeholder.wav"),
  speech: resolve(root, "public/output/speech"),
};

const ensureOutputDirs = async () => {
  await Promise.all(
    [
      dirname(outputPaths.storyboard),
      outputPaths.projects,
      dirname(outputPaths.video),
      dirname(outputPaths.still),
      outputPaths.thumbnails,
      dirname(outputPaths.music),
      outputPaths.speech,
    ].map((path) => mkdir(path, {recursive: true})),
  );
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const jobs = new Map();

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "project";

const getProjectPath = (id) => {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("Invalid project id");
  return resolve(outputPaths.projects, `${id}.json`);
};

const readProject = async (id) => JSON.parse(await readFile(getProjectPath(id), "utf8"));

const writeProject = async (id, storyboard) =>
  writeFile(
    getProjectPath(id),
    `${JSON.stringify({...storyboard, updatedAt: new Date().toISOString()}, null, 2)}\n`,
  );

const createProject = async (storyboard) => {
  const projectId = `${Date.now()}-${slugify(storyboard.topic ?? storyboard.title ?? "project")}`;
  await writeProject(projectId, storyboard);
  return projectId;
};

const createJob = async (type, steps) => {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job = {
    id,
    type,
    status: "queued",
    step: "Queued",
    logs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.set(id, job);

  queueMicrotask(async () => {
    try {
      job.status = "running";
      for (const step of steps) {
        job.step = step.label;
        job.updatedAt = new Date().toISOString();
        job.logs.push(`[${new Date().toLocaleTimeString()}] ${step.label}`);
        await step.run();
      }
      job.status = "complete";
      job.step = "Complete";
      job.updatedAt = new Date().toISOString();
      job.logs.push(`[${new Date().toLocaleTimeString()}] Done`);
    } catch (error) {
      job.status = "failed";
      job.step = "Failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date().toISOString();
      job.logs.push(`[${new Date().toLocaleTimeString()}] Error: ${job.error}`);
    }
  });

  return job;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const runNode = (args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(nodeExecutable, args, {
      cwd: root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) { resolvePromise({stdout, stderr}); return; }
      reject(new Error(stderr || stdout || `Command failed with exit code ${code}`));
    });
  });

const jsonResponse = (response, status, body) => {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
};

// ---------------------------------------------------------------------------
// Model server proxy helpers
// ---------------------------------------------------------------------------
const modelServerFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const response = await fetch(`${modelServerBase}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {"content-type": "application/json", ...(options.headers ?? {})},
    });
    return {ok: response.ok, data: await response.json()};
  } catch (error) {
    return {
      ok: false,
      data: {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Model server timed out"
            : "Model server unreachable",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
};

const writeSilentWav = async (path, durationSeconds = 1.5) => {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const totalSamples = Math.max(1, Math.round(sampleRate * durationSeconds));
  const dataSize = totalSamples * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  const writeString = (offset, value) => buffer.write(value, offset, "ascii");

  writeString(0, "RIFF");
  buffer.writeUInt32LE(36 + dataSize, 4);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  writeString(36, "data");
  buffer.writeUInt32LE(dataSize, 40);
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, buffer);
};

const ensureSpeechFallbacks = async (storyboard) => {
  await mkdir(outputPaths.speech, {recursive: true});
  await Promise.all(
    storyboard.scenes.map((scene, index) => {
      const path = resolve(outputPaths.speech, `scene-${String(index + 1).padStart(2, "0")}.wav`);
      return existsSync(path) ? undefined : writeSilentWav(path, Math.min(3, scene.durationSeconds));
    }),
  );
};

const generateLocalMusic = async (prompt) =>
  runNode([
    "node_modules/tsx/dist/cli.mjs",
    "scripts/create-music.ts",
    "--provider=placeholder",
    `--prompt=${prompt}`,
    "--duration=65",
    "--out=public/output/music/generated.wav",
  ]);

// ---------------------------------------------------------------------------
// Full video generation pipeline
// ---------------------------------------------------------------------------
const runFullGeneration = async (body, job) => {
  const llmProvider = body.llm?.provider ?? "mock";
  const ollamaModel = body.llm?.ollamaModel ?? "qwen2.5:7b";
  const ollamaUrl = body.llm?.ollamaUrl ?? "http://localhost:11434";
  const musicModel = body.musicModel ?? "placeholder";
  const speechVoice = body.speechVoice ?? "af_heart";

  // Step 1 — Generate storyboard via LLM
  const storyboardArgs = [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/create-storyboard.ts",
    `--topic=${body.topic ?? "AI-generated one-minute explainers"}`,
    `--audience=${body.audience ?? "founders and content teams"}`,
    `--tone=${body.tone ?? "bold"}`,
    `--aspect=${body.aspectRatio ?? "16:9"}`,
    `--sources=${body.sources ?? ""}`,
    `--llm-provider=${llmProvider}`,
    `--ollama-model=${ollamaModel}`,
    `--ollama-url=${ollamaUrl}`,
    `--voice=${speechVoice}`,
  ];

  job.step = "LLM generating storyboard";
  job.updatedAt = new Date().toISOString();
  job.logs.push("LLM -> storyboard JSON");
  await runNode(storyboardArgs);

  const storyboard = JSON.parse(await readFile(outputPaths.storyboard, "utf8"));
  job.storyboard = storyboard;
  await createProject(storyboard);
  job.step = `Narration (${storyboard.scenes.length} scenes)`;
  job.updatedAt = new Date().toISOString();
  job.logs.push(`Narration -> ${storyboard.scenes.length} Kokoro tracks`);

  // Step 2 — Generate per-scene TTS narration (if model server is up)
  const modelStatus = await modelServerFetch("/status");
  if (modelStatus.ok) {
    const sceneBatch = storyboard.scenes.map((scene, index) => ({
      text: scene.narration,
      scene_index: index + 1,
      voice: storyboard.speechVoice ?? speechVoice,
      speed: 0.95,
    }));

    const ttsResult = await modelServerFetch("/speech/batch", {
      method: "POST",
      body: JSON.stringify({scenes: sceneBatch}),
    });

    if (!ttsResult.ok) {
      job.logs.push(`TTS warning: ${ttsResult.data?.error ?? "batch failed, narration skipped"}`);
    } else {
      job.logs.push(`TTS: generated ${ttsResult.data?.results?.length ?? 0} narration tracks`);
    }

    // Step 3 — Generate music (if musicgen is selected)
    await ensureSpeechFallbacks(storyboard);
    job.step = musicModel === "musicgen" ? "MusicGen generating music" : "Preparing local music";
    job.updatedAt = new Date().toISOString();
    job.logs.push(`Music -> ${musicModel}`);

    if (musicModel === "musicgen") {
      const musicResult = await modelServerFetch("/music", {
        method: "POST",
        body: JSON.stringify({
          prompt: storyboard.musicPrompt,
          duration_seconds: 65, // slightly longer than 60s to avoid abrupt ending
        }),
      });

      if (!musicResult.ok) {
        job.logs.push(`Music warning: ${musicResult.data?.error ?? "MusicGen failed"}`);
        await generateLocalMusic(storyboard.musicPrompt);
      } else {
        job.logs.push("Music: generated.wav ready");
      }
    } else {
      // placeholder — generate silent/synth wav if it doesn't exist
      await generateLocalMusic(storyboard.musicPrompt);
    }
  } else {
    job.logs.push("Model server offline - using silent narration and local synth music");
    await ensureSpeechFallbacks(storyboard);
    await generateLocalMusic(storyboard.musicPrompt);
  }

  // Always ensure generated.wav exists for Remotion (copy placeholder if needed)
  if (!existsSync(outputPaths.music)) {
    if (existsSync(outputPaths.musicFallback)) {
      await copyFile(outputPaths.musicFallback, outputPaths.music);
    } else {
      await generateLocalMusic(storyboard.musicPrompt);
      if (existsSync(outputPaths.musicFallback)) {
        await copyFile(outputPaths.musicFallback, outputPaths.music);
      }
    }
  }

  // Step 4 — Remotion render
  job.step = "Rendering MP4";
  job.updatedAt = new Date().toISOString();
  job.logs.push("Rendering -> Remotion MP4");
  const scaleArgs = body.scale && body.scale !== "1" ? [`--scale=${body.scale}`] : [];
  await runNode([
    "node_modules/@remotion/cli/remotion-cli.js",
    "render",
    "InfographicMinute",
    "public/output/videos/infographic.mp4",
    "--props=output/storyboards/storyboard.json",
    "--concurrency=2",
    ...scaleArgs,
  ]);
};

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const api = createServer(async (request, response) => {
  if (request.method === "OPTIONS") { jsonResponse(response, 200, {}); return; }

  try {
    await ensureOutputDirs();

    // Health
    if (request.url === "/api/status" && request.method === "GET") {
      jsonResponse(response, 200, {
        ok: true,
        outputs: {
          storyboard: existsSync(outputPaths.storyboard),
          video: existsSync(outputPaths.video) || existsSync(outputPaths.musicFallback),
          still: existsSync(outputPaths.still),
          music: existsSync(outputPaths.music) || existsSync(outputPaths.musicFallback),
        },
      });
      return;
    }

    // Model server status proxy
    if (request.url === "/api/model-server/status" && request.method === "GET") {
      const {ok, data} = await modelServerFetch("/status");
      jsonResponse(response, ok ? 200 : 503, {ok, ...data});
      return;
    }

    // Generic model server proxy: /model-api/* -> http://localhost:8001/*
    if (request.url?.startsWith("/model-api/")) {
      const path = request.url.replace(/^\/model-api/, "");
      const body = request.method === "GET" ? undefined : await readJsonBody(request);
      const {ok, data} = await modelServerFetch(path, {
        method: request.method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      jsonResponse(response, ok ? 200 : 502, {ok, ...data});
      return;
    }

    // Thumbnails list
    if (request.url === "/api/thumbnails" && request.method === "GET") {
      const entries = await readdir(outputPaths.thumbnails, {withFileTypes: true});
      const thumbnails = entries
        .filter((e) => e.isFile() && e.name.endsWith(".png"))
        .map((e) => `/output/thumbnails/${e.name}`)
        .sort();
      jsonResponse(response, 200, {ok: true, thumbnails});
      return;
    }

    // Jobs list
    if (request.url === "/api/jobs" && request.method === "GET") {
      jsonResponse(response, 200, {ok: true, jobs: Array.from(jobs.values()).reverse()});
      return;
    }

    // Job by id
    if (request.url?.startsWith("/api/jobs/") && request.method === "GET") {
      const id = request.url.split("/").pop();
      const job = jobs.get(id);
      jsonResponse(response, job ? 200 : 404, {ok: Boolean(job), job, error: job ? undefined : "Job not found"});
      return;
    }

    // Projects list
    if (request.url === "/api/projects" && request.method === "GET") {
      const entries = await readdir(outputPaths.projects, {withFileTypes: true});
      const projects = await Promise.all(
        entries
          .filter((e) => e.isFile() && e.name.endsWith(".json"))
          .map(async (e) => {
            const project = JSON.parse(await readFile(resolve(outputPaths.projects, e.name), "utf8"));
            return {
              id: e.name.replace(/\.json$/, ""),
              title: project.title,
              topic: project.topic,
              aspectRatio: project.aspectRatio,
              updatedAt: project.updatedAt,
            };
          }),
      );
      projects.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
      jsonResponse(response, 200, {ok: true, projects});
      return;
    }

    // Project CRUD
    if (request.url?.startsWith("/api/projects/")) {
      const [, , , id, action] = request.url.split("/");

      if (request.method === "GET" && id && !action) {
        jsonResponse(response, 200, {ok: true, storyboard: await readProject(id)});
        return;
      }
      if (request.method === "POST" && id && action === "load") {
        const storyboard = await readProject(id);
        await writeFile(outputPaths.storyboard, `${JSON.stringify(storyboard, null, 2)}\n`);
        jsonResponse(response, 200, {ok: true, storyboard});
        return;
      }
      if (request.method === "POST" && id && action === "duplicate") {
        const storyboard = await readProject(id);
        const projectId = await createProject({...storyboard, title: `${storyboard.title ?? "Untitled"} copy`});
        jsonResponse(response, 200, {ok: true, projectId, storyboard: await readProject(projectId)});
        return;
      }
      if (request.method === "DELETE" && id && !action) {
        await unlink(getProjectPath(id));
        jsonResponse(response, 200, {ok: true});
        return;
      }
      jsonResponse(response, 404, {ok: false, error: "Project route not found"});
      return;
    }

    // ------------------------------------------------------------------
    // MAIN GENERATION PIPELINE  POST /api/generate-video
    // ------------------------------------------------------------------
    if (request.url === "/api/generate-video" && request.method === "POST") {
      const body = await readJsonBody(request);

      // Create job directly (no dummy steps — we manage the lifecycle manually)
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const job = {
        id,
        type: "generate-video",
        status: "running",
        step: "LLM generating storyboard",
        logs: [`[${new Date().toLocaleTimeString()}] Job started`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(id, job);

      // Run pipeline asynchronously
      (async () => {
        try {
          job.logs.push(`[${new Date().toLocaleTimeString()}] LLM: ${body.llm?.ollamaModel ?? "built-in"}`);
          await runFullGeneration(body, job);
          job.status = "complete";
          job.step = "Complete";
          job.updatedAt = new Date().toISOString();
          job.logs.push(`[${new Date().toLocaleTimeString()}] Video ready`);
        } catch (error) {
          job.status = "failed";
          job.step = "Failed";
          job.error = error instanceof Error ? error.message : String(error);
          job.updatedAt = new Date().toISOString();
          job.logs.push(`[${new Date().toLocaleTimeString()}] Error: ${job.error}`);
        }
      })();

      jsonResponse(response, 200, {ok: true, job});
      return;
    }

    // Legacy storyboard-only generation
    if (request.url === "/api/storyboard" && request.method === "POST") {
      const body = await readJsonBody(request);
      const args = [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/create-storyboard.ts",
        `--topic=${body.topic ?? "AI-generated one-minute explainers"}`,
        `--audience=${body.audience ?? "founders and content teams"}`,
        `--tone=${body.tone ?? "bold"}`,
        `--aspect=${body.aspectRatio ?? "16:9"}`,
        `--sources=${body.sources ?? ""}`,
        `--llm-provider=${body.llm?.provider ?? "mock"}`,
        `--ollama-model=${body.llm?.ollamaModel ?? "qwen2.5:7b"}`,
        `--ollama-url=${body.llm?.ollamaUrl ?? "http://localhost:11434"}`,
      ];
      await runNode(args);
      const storyboard = JSON.parse(await readFile(outputPaths.storyboard, "utf8"));
      await createProject(storyboard);
      jsonResponse(response, 200, {ok: true, storyboard});
      return;
    }

    // Save storyboard
    if (request.url === "/api/storyboard/save" && request.method === "POST") {
      const body = await readJsonBody(request);
      await writeFile(outputPaths.storyboard, `${JSON.stringify(body.storyboard, null, 2)}\n`);
      await createProject(body.storyboard);
      jsonResponse(response, 200, {ok: true});
      return;
    }

    // Music only
    if (request.url === "/api/music" && request.method === "POST") {
      const body = await readJsonBody(request);
      const musicModel = body.musicModel ?? "placeholder";

      const job = await createJob("music", [
        {
          label: musicModel === "musicgen" ? "MusicGen generating audio" : "Generating placeholder music",
          run: async () => {
            if (musicModel === "musicgen" && body.prompt) {
              const result = await modelServerFetch("/music", {
                method: "POST",
                body: JSON.stringify({prompt: body.prompt, duration_seconds: body.durationSeconds ?? 65}),
              });
              if (!result.ok) throw new Error(result.data?.error ?? "MusicGen failed");
            } else {
              await runNode(["node_modules/tsx/dist/cli.mjs", "scripts/create-placeholder-music.ts"]);
            }
          },
        },
      ]);
      jsonResponse(response, 200, {ok: true, job});
      return;
    }

    // Still render
    if (request.url === "/api/still" && request.method === "POST") {
      const body = await readJsonBody(request);
      const scale = String(body.scale ?? 0.25);
      const job = await createJob("still", [
        {
          label: "Rendering still",
          run: () =>
            runNode([
              "node_modules/@remotion/cli/remotion-cli.js",
              "still",
              "InfographicMinute",
              "public/output/stills/frame.png",
              "--frame=90",
              `--scale=${scale}`,
              "--props=output/storyboards/storyboard.json",
            ]),
        },
      ]);
      jsonResponse(response, 200, {ok: true, job});
      return;
    }

    // Thumbnails render
    if (request.url === "/api/thumbnails" && request.method === "POST") {
      const body = await readJsonBody(request);
      const scale = String(body.scale ?? 0.16);
      const storyboard = JSON.parse(await readFile(outputPaths.storyboard, "utf8"));
      let startFrame = 0;
      const steps = storyboard.scenes.map((scene, index) => {
        const frame = startFrame + Math.max(1, Math.floor((scene.durationSeconds * 30) / 2));
        startFrame += scene.durationSeconds * 30;
        return {
          label: `Rendering thumbnail ${index + 1}`,
          run: () =>
            runNode([
              "node_modules/@remotion/cli/remotion-cli.js",
              "still",
              "InfographicMinute",
              `public/output/thumbnails/scene-${String(index + 1).padStart(2, "0")}.png`,
              `--frame=${frame}`,
              `--scale=${scale}`,
              "--props=output/storyboards/storyboard.json",
            ]),
        };
      });
      const job = await createJob("thumbnails", steps);
      jsonResponse(response, 200, {ok: true, job});
      return;
    }

    // Full render (storyboard must already exist)
    if (request.url === "/api/render" && request.method === "POST") {
      const body = await readJsonBody(request);
      const scaleArgs = body.scale && body.scale !== "1" ? [`--scale=${body.scale}`] : [];
      const job = await createJob("render", [
        {
          label: "Rendering MP4",
          run: () =>
            runNode([
              "node_modules/@remotion/cli/remotion-cli.js",
              "render",
              "InfographicMinute",
              "public/output/videos/infographic.mp4",
              "--props=output/storyboards/storyboard.json",
              ...scaleArgs,
            ]),
        },
      ]);
      jsonResponse(response, 200, {ok: true, job});
      return;
    }

    jsonResponse(response, 404, {ok: false, error: "Not found"});
  } catch (error) {
    jsonResponse(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

api.listen(apiPort, () => {
  console.log(`Presently API running at http://localhost:${apiPort}`);
  console.log(`Model server expected at http://localhost:${modelServerPort}`);
});

const vite = await createViteServer({
  root,
  server: {
    port,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/model-api": `http://localhost:${apiPort}`,
    },
  },
});

await vite.listen();
vite.printUrls();
