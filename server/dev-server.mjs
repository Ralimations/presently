import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir, readFile, readdir, unlink, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer as createViteServer} from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeExecutable = process.execPath;
const port = Number(process.env.PRESENTLY_PORT ?? 5173);
const apiPort = Number(process.env.PRESENTLY_API_PORT ?? 8787);

const outputPaths = {
  storyboard: resolve(root, "output/storyboards/storyboard.json"),
  projects: resolve(root, "output/projects"),
  video: resolve(root, "public/output/videos/infographic.mp4"),
  still: resolve(root, "public/output/stills/frame.png"),
  thumbnails: resolve(root, "public/output/thumbnails"),
  music: resolve(root, "public/output/music/placeholder.wav"),
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
    ].map((path) => mkdir(path, {recursive: true})),
  );
};

const jobs = new Map();

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "project";

const getProjectPath = (id) => {
  if (!/^[a-z0-9-]+$/i.test(id)) {
    throw new Error("Invalid project id");
  }

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
        await step.run();
      }
      job.status = "complete";
      job.step = "Complete";
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.step = "Failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date().toISOString();
    }
  });

  return job;
};

const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

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

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({stdout, stderr});
        return;
      }

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

const api = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    jsonResponse(response, 200, {});
    return;
  }

  try {
    await ensureOutputDirs();

    if (request.url === "/api/status" && request.method === "GET") {
      jsonResponse(response, 200, {
        ok: true,
        outputs: {
          storyboard: existsSync(outputPaths.storyboard),
          video: existsSync(outputPaths.video),
          still: existsSync(outputPaths.still),
          music: existsSync(outputPaths.music),
        },
      });
      return;
    }

    if (request.url === "/api/thumbnails" && request.method === "GET") {
      const entries = await readdir(outputPaths.thumbnails, {withFileTypes: true});
      const thumbnails = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
        .map((entry) => `/output/thumbnails/${entry.name}`)
        .sort();
      jsonResponse(response, 200, {ok: true, thumbnails});
      return;
    }

    if (request.url === "/api/jobs" && request.method === "GET") {
      jsonResponse(response, 200, {
        ok: true,
        jobs: Array.from(jobs.values()).reverse(),
      });
      return;
    }

    if (request.url?.startsWith("/api/jobs/") && request.method === "GET") {
      const id = request.url.split("/").pop();
      const job = jobs.get(id);
      jsonResponse(response, job ? 200 : 404, {
        ok: Boolean(job),
        job,
        error: job ? undefined : "Job not found",
      });
      return;
    }

    if (request.url === "/api/projects" && request.method === "GET") {
      const entries = await readdir(outputPaths.projects, {withFileTypes: true});
      const projects = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map(async (entry) => {
            const project = JSON.parse(
              await readFile(resolve(outputPaths.projects, entry.name), "utf8"),
            );
            return {
              id: entry.name.replace(/\.json$/, ""),
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

    if (request.url?.startsWith("/api/projects/")) {
      const [, , , id, action] = request.url.split("/");

      if (request.method === "GET" && id && !action) {
        const storyboard = await readProject(id);
        jsonResponse(response, 200, {ok: true, storyboard});
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
        const projectId = await createProject({
          ...storyboard,
          title: `${storyboard.title ?? "Untitled"} copy`,
        });
        const duplicated = await readProject(projectId);
        jsonResponse(response, 200, {ok: true, projectId, storyboard: duplicated});
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
      ];

      await runNode(args);
      const storyboard = JSON.parse(await readFile(outputPaths.storyboard, "utf8"));
      await createProject(storyboard);
      jsonResponse(response, 200, {ok: true, storyboard});
      return;
    }

    if (request.url === "/api/storyboard/save" && request.method === "POST") {
      const body = await readJsonBody(request);
      await writeFile(outputPaths.storyboard, `${JSON.stringify(body.storyboard, null, 2)}\n`);
      await createProject(body.storyboard);
      jsonResponse(response, 200, {ok: true});
      return;
    }

    if (request.url === "/api/music" && request.method === "POST") {
      const job = await createJob("music", [
        {
          label: "Generating music",
          run: () => runNode(["node_modules/tsx/dist/cli.mjs", "scripts/create-placeholder-music.ts"]),
        },
      ]);
      jsonResponse(response, 200, {ok: true, job});
      return;
    }

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

    if (request.url === "/api/render" && request.method === "POST") {
      const body = await readJsonBody(request);
      const scaleArgs = body.scale && body.scale !== "1"
        ? [`--scale=${body.scale}`]
        : [];
      const job = await createJob("render", [
        {
          label: "Generating music",
          run: () => runNode(["node_modules/tsx/dist/cli.mjs", "scripts/create-placeholder-music.ts"]),
        },
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
});

const vite = await createViteServer({
  root,
  server: {
    port,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
});

await vite.listen();
vite.printUrls();
