import {spawn} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";

type MusicProvider = "placeholder" | "ace-step" | "musicgen";

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);

const provider = (args.get("provider") ?? "placeholder") as MusicProvider;
const prompt = args.get("prompt") ?? "cinematic instrumental bed for a one-minute explainer";
const outputPath = args.get("out") ?? "public/output/music/placeholder.wav";
const durationSeconds = Number(args.get("duration") ?? 60);
const checkpointPath = args.get("checkpoint") ?? "models/music/ace-step";
const pythonPath = args.get("python") ?? "models/.venv/Scripts/python.exe";
const allowHeavyAceStep =
  process.env.PRESENTLY_ENABLE_ACE_STEP === "1" || args.get("allow-heavy") === "true";

const log = (message: string) => {
  console.log(`[music] ${message}`);
};

const writeWav = (samples: Int16Array, sampleRate: number, channels: number) => {
  const bitsPerSample = 16;
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  const writeString = (offset: number, value: string) => {
    buffer.write(value, offset, "ascii");
  };

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

  samples.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  mkdirSync(dirname(outputPath), {recursive: true});
  writeFileSync(outputPath, buffer);
};

const hashPrompt = (value: string) =>
  [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);

const createProceduralMusic = () => {
  log("generating local procedural music bed");
  const sampleRate = 44100;
  const channels = 2;
  const totalFrames = Math.max(1, Math.round(sampleRate * durationSeconds));
  const samples = new Int16Array(totalFrames * channels);
  const seed = hashPrompt(prompt);
  const isBright = /pop|upbeat|product|launch|clean|bright|happy/i.test(prompt);
  const isDark = /cinematic|dramatic|mystery|history|academic/i.test(prompt);
  const root = isBright ? 196 : isDark ? 110 : 146.83;
  const progression = [
    [1, 1.5, 2],
    [0.84, 1.26, 1.89],
    [0.75, 1.125, 1.6875],
    [0.89, 1.335, 2],
  ];

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const seconds = frame / sampleRate;
    const beat = seconds * 1.8;
    const bar = Math.floor(beat / 4);
    const chord = progression[bar % progression.length];
    const fadeIn = Math.min(1, seconds / 3);
    const fadeOut = Math.min(1, (durationSeconds - seconds) / 5);
    const envelope = fadeIn * fadeOut;
    const pulse = Math.max(0, 1 - ((beat % 1) * 2.5)) * 0.18;
    const kick = Math.sin(2 * Math.PI * 54 * seconds) * pulse;
    const pad = chord.reduce((sum, ratio, index) => {
      const detune = ((seed >> (index * 5)) & 7) * 0.12;
      return sum + Math.sin(2 * Math.PI * (root * ratio + detune) * seconds) * 0.09;
    }, 0);
    const melodyStep = Math.floor(seconds * 2) % 8;
    const melodyRatio = [1, 1.125, 1.25, 1.5, 1.25, 1.125, 0.89, 1][melodyStep];
    const melodyGate = (seconds * 2) % 1 < 0.55 ? 1 : 0;
    const melody = Math.sin(2 * Math.PI * root * 2 * melodyRatio * seconds) * 0.055 * melodyGate;
    const shimmer = Math.sin(2 * Math.PI * (root * 4.01) * seconds) * 0.025;
    const signal = Math.max(-1, Math.min(1, (kick + pad + melody + shimmer) * envelope));
    const pan = Math.sin(seconds * 0.45) * 0.18;
    const left = Math.max(-1, Math.min(1, signal * (1 - pan)));
    const right = Math.max(-1, Math.min(1, signal * (1 + pan)));
    samples[frame * 2] = Math.round(left * 32767);
    samples[frame * 2 + 1] = Math.round(right * 32767);

    if (frame > 0 && frame % (sampleRate * 10) === 0) {
      log(`procedural render ${Math.round(seconds)}s/${durationSeconds}s`);
    }
  }

  writeWav(samples, sampleRate, channels);
  log(`wrote music bed to ${outputPath}`);
};

const hasAceStepWeights = () => {
  if (!existsSync(checkpointPath)) {
    return false;
  }

  const extensions = [".safetensors", ".bin", ".pt", ".pth", ".ckpt"];
  const queue = [checkpointPath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const entryPath = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
        return true;
      }
    }
  }

  return false;
};

const runAceStep = () =>
  new Promise<void>((resolvePromise, reject) => {
    log(`starting ACE-Step with checkpoints at ${checkpointPath}`);
    const child = spawn(
      pythonPath,
      [
        "scripts/ace-step-music.py",
        `--checkpoint=${checkpointPath}`,
        `--prompt=${prompt}`,
        `--duration=${durationSeconds}`,
        `--out=${outputPath}`,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`ACE-Step exited with code ${code}`));
    });
  });

const main = async () => {
  log(`provider: ${provider}`);
  log(`prompt: ${prompt.slice(0, 220)}`);

  if (provider === "ace-step") {
    log("ACE-Step is disabled by default for the RTX 2060 6GB profile");
    log("set PRESENTLY_ENABLE_ACE_STEP=1 only after installing weights and fixing the CUDA driver");
    log("checking ACE-Step local checkpoints");
    if (hasAceStepWeights() && allowHeavyAceStep) {
      await runAceStep();
      log("ACE-Step generation complete");
      console.log(
        `PRESENTLY_MUSIC_META ${JSON.stringify({provider, outputPath, usedFallback: false})}`,
      );
      return;
    }

    if (!hasAceStepWeights()) {
      log(`ACE-Step checkpoints not found at ${checkpointPath}`);
    } else {
      log("ACE-Step checkpoints found, but heavy generation is not enabled for this hardware profile");
    }
    log("falling back to local procedural music");
  }

  if (provider === "musicgen") {
    log("MusicGen provider selected, but local AudioCraft weights are not installed");
    log("falling back to local procedural music");
  }

  createProceduralMusic();
  console.log(
    `PRESENTLY_MUSIC_META ${JSON.stringify({
      provider,
      outputPath,
      usedFallback: provider !== "placeholder",
    })}`,
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
