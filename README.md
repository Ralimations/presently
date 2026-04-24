# Presently — Local AI Video Studio

Generate fully-narrated, 60-second infographic videos from a single text prompt.
Everything runs **locally** on your machine — no API keys, no cloud services.

---

## What it does

1. **LLM designs the video** — Qwen 2.5 7B (via Ollama) reads your prompt and produces a complete storyboard: color palette, layout per scene, typography, camera moves, data visualizations, narration scripts, and a music brief.
2. **Kokoro TTS narrates each scene** — a fast ONNX voice model reads the narration text and generates per-scene WAV files.
3. **MusicGen generates the soundtrack** — Meta's MusicGen-small creates an original 60-second instrumental track from the LLM's music description.
4. **Remotion renders the video** — a fully dynamic renderer (no templates) turns the LLM's JSON into a polished MP4 with animated charts, kinetic text, camera moves, and synced audio.

**All open-source. All local. Designed for RTX 2060 (6 GB VRAM) / 32 GB RAM.**

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | 18+ |
| Python | 3.11 |
| Ollama | latest |
| NVIDIA GPU | RTX 2060 or better (CPU fallback supported) |
| RAM | 16 GB minimum, 32 GB recommended |

---

## Quick Start

### 1. Install dependencies

```powershell
# Install Node packages
npm install

# Install Python AI stack (in models/.venv)
.\install_open_source_ai_models.ps1 -Torch cuda
```

### 2. Pull the LLM

```powershell
ollama pull qwen2.5:7b
```

### 3. Start the model server (TTS + MusicGen)

```powershell
.\run_model_server.ps1
```

Endpoints available at `http://localhost:8001`:
- `GET  /status` — check which models are loaded
- `POST /speech/batch` — generate narration WAVs for all scenes
- `POST /music` — generate background music track

### 4. Start Presently

```powershell
npm run dev
```

Open **http://localhost:5173**

### One-command local stack

You can start Ollama, the model server, and the Presently site in separate PowerShell windows:

```powershell
.\run_presently_stack.ps1
```

Use flags when needed:

```powershell
.\run_presently_stack.ps1 -SkipOllama
.\run_presently_stack.ps1 -SkipModelServer
.\run_presently_stack.ps1 -OllamaModel qwen2.5:3b
```

---

## How to generate a video

1. Type your topic in the prompt field (e.g. *"The history of space exploration"*)
2. Set the audience, format, and voice
3. Select your LLM (Qwen 2.5 7B recommended)
4. Choose music: **Synth placeholder** (instant) or **MusicGen** (requires model server)
5. Click **Generate video** or press `⌘ Enter`

The pipeline runs in order:
```
LLM → Narration (Kokoro TTS) → Music (MusicGen) → Remotion render
```

The model server status badge in the top-right corner shows green when TTS and MusicGen are available. If it's red, the video still generates but without spoken narration or AI music.

---

## VRAM Management (RTX 2060, 6 GB)

| Stage | VRAM used | Notes |
|---|---|---|
| LLM (Qwen 2.5 7B Q4) | ~4.5 GB | Ollama auto-evicts after idle |
| MusicGen-small | ~600 MB | Runs after LLM finishes |
| Kokoro TTS | 0 GB | CPU only (ONNX) |
| Remotion render | 0 GB | Node.js / CPU |

The pipeline is **sequential** — LLM runs first, then Ollama evicts from VRAM, then MusicGen uses the freed GPU. You will not run out of VRAM.

---

## Available models (LLM)

All accessed via Ollama. Pull with `ollama pull <model>`:

| Model | VRAM | Quality | Speed |
|---|---|---|---|
| `qwen2.5:7b` | 4.5 GB | ⭐⭐⭐⭐ Best JSON | Moderate |
| `qwen2.5:3b` | 2.2 GB | ⭐⭐⭐ Good | Fast |
| `mistral:7b` | 4.5 GB | ⭐⭐⭐ Good | Moderate |
| `llama3.2:3b` | 2.2 GB | ⭐⭐ Decent | Fast |
| `gemma3:4b` | 2.8 GB | ⭐⭐⭐ Good | Moderate |

If Ollama is not running, the **Built-in (offline)** option uses a deterministic fallback storyboard.

---

## TTS Voices (Kokoro)

| Voice ID | Character |
|---|---|
| `af_heart` | Warm American female (default) |
| `af_bella` | Bright American female |
| `am_michael` | Deep American male |
| `af_sarah` | Calm American female |

Voices auto-download on first use (~165 MB total).

---

## Project structure

```
presently-1/
├── models/
│   ├── model_server.py          ← FastAPI server (TTS + MusicGen)
│   ├── requirements-model-server.txt
│   └── .venv/                   ← Python virtual environment
├── scripts/
│   └── create-storyboard.ts     ← LLM prompt + Ollama integration
├── server/
│   └── dev-server.mjs           ← Orchestration API + Vite proxy
├── src/
│   ├── remotion/
│   │   ├── InfographicMinute.tsx ← Dynamic Remotion renderer (no templates)
│   │   └── video.css            ← Design system
│   ├── storyboard/
│   │   ├── schema.ts            ← Zod schema (LLM output contract)
│   │   └── generateStoryboard.ts ← Built-in fallback storyboard
│   └── main.tsx                 ← React UI
├── run_model_server.ps1         ← Start TTS + MusicGen server
└── install_open_source_ai_models.ps1
```

---

## Troubleshooting

**"Model server offline" badge** — Run `.\run_model_server.ps1` in a separate terminal. First run downloads Kokoro voice models (~165 MB).

**Ollama not found** — Install from https://ollama.ai then run `ollama pull qwen2.5:7b`.

**MusicGen out of VRAM** — Let Ollama finish and idle for ~30s first. Or switch to "Synth placeholder" music.

**Video has no audio** — The model server was offline during generation. Start the model server and regenerate.

**LLM storyboard validation fails** — Switch to `qwen2.5:7b` (best structured JSON output). The built-in fallback activates automatically.
