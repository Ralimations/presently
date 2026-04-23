import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
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
  video: resolve(root, "public/output/videos/infographic.mp4"),
  still: resolve(root, "public/output/stills/frame.png"),
  music: resolve(root, "public/output/music/placeholder.wav"),
};

const ensureOutputDirs = async () => {
  await Promise.all(
    Object.values(outputPaths).map((path) => mkdir(dirname(path), {recursive: true})),
  );
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
    "access-control-allow-methods": "GET,POST,OPTIONS",
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
      jsonResponse(response, 200, {ok: true, storyboard});
      return;
    }

    if (request.url === "/api/storyboard/save" && request.method === "POST") {
      const body = await readJsonBody(request);
      await writeFile(outputPaths.storyboard, `${JSON.stringify(body.storyboard, null, 2)}\n`);
      jsonResponse(response, 200, {ok: true});
      return;
    }

    if (request.url === "/api/music" && request.method === "POST") {
      await runNode(["node_modules/tsx/dist/cli.mjs", "scripts/create-placeholder-music.ts"]);
      jsonResponse(response, 200, {ok: true, url: "/output/music/placeholder.wav"});
      return;
    }

    if (request.url === "/api/still" && request.method === "POST") {
      await runNode([
        "node_modules/@remotion/cli/remotion-cli.js",
        "still",
        "InfographicMinute",
        "public/output/stills/frame.png",
        "--frame=90",
        "--scale=0.25",
        "--props=output/storyboards/storyboard.json",
      ]);
      jsonResponse(response, 200, {ok: true, url: `/output/stills/frame.png?t=${Date.now()}`});
      return;
    }

    if (request.url === "/api/render" && request.method === "POST") {
      await runNode([
        "node_modules/@remotion/cli/remotion-cli.js",
        "render",
        "InfographicMinute",
        "public/output/videos/infographic.mp4",
        "--props=output/storyboards/storyboard.json",
      ]);
      jsonResponse(response, 200, {ok: true, url: `/output/videos/infographic.mp4?t=${Date.now()}`});
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
