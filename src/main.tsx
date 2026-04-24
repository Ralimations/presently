import {StrictMode, useEffect, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {generateStoryboard} from "./storyboard/generateStoryboard";
import {AspectRatio, Storyboard, ttsVoices, TtsVoice} from "./storyboard/schema";
import "./styles.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Screen = "compose" | "progress" | "preview";
type MusicModel = "placeholder" | "musicgen";

type LlmSettings = {
  provider: "mock" | "ollama";
  ollamaModel: string;
  ollamaUrl: string;
};

type GenerationSettings = {
  prompt: string;
  audience: string;
  aspectRatio: AspectRatio;
  llm: LlmSettings;
  musicModel: MusicModel;
  speechVoice: TtsVoice;
  renderScale: number;
};

type RenderJob = {
  id: string;
  type: string;
  status: "queued" | "running" | "complete" | "failed";
  step: string;
  logs?: string[];
  storyboard?: Storyboard;
  error?: string;
};

type ModelServerStatus = "unknown" | "online" | "offline";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const STORAGE_KEY = "presently:v2-settings";

const DEFAULT_SETTINGS: GenerationSettings = {
  prompt: "",
  audience: "curious viewers",
  aspectRatio: "16:9",
  llm: {provider: "ollama", ollamaModel: "qwen2.5:7b", ollamaUrl: "http://localhost:11434"},
  musicModel: "placeholder",
  speechVoice: "af_heart",
  renderScale: 0.35,
};

const VOICE_LABELS: Record<TtsVoice, string> = {
  af_heart: "Heart (warm female)",
  af_bella: "Bella (bright female)",
  am_michael: "Michael (deep male)",
  af_sarah: "Sarah (calm female)",
};

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
const loadSettings = (): GenerationSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {...DEFAULT_SETTINGS, ...JSON.parse(raw)};
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const postJson = async <T,>(url: string, body: unknown, timeoutMs = 90000): Promise<T> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as T & {ok?: boolean; error?: string};
    if (!res.ok || (data as {ok?: boolean}).ok === false) throw new Error((data as {error?: string}).error ?? "Request failed");
    return data;
  } finally {
    window.clearTimeout(timer);
  }
};

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = (await res.json()) as T & {ok?: boolean; error?: string};
  if (!res.ok) throw new Error((data as {error?: string}).error ?? "Request failed");
  return data;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App = () => {
  const [screen, setScreen] = useState<Screen>("compose");
  const [settings, setSettings] = useState<GenerationSettings>(loadSettings);
  const [storyboard, setStoryboard] = useState<Storyboard>(() =>
    generateStoryboard({topic: "AI-generated infographic videos", audience: "curious viewers", tone: "bold", aspectRatio: "16:9"}),
  );
  const [videoUrl, setVideoUrl] = useState("/output/videos/infographic.mp4");
  const [progressLabel, setProgressLabel] = useState("Ready");
  const [progressPct, setProgressPct] = useState(0);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [progressError, setProgressError] = useState("");
  const [modelServerStatus, setModelServerStatus] = useState<ModelServerStatus>("unknown");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Persist settings
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Check model server on mount and every 15s
  useEffect(() => {
    const check = async () => {
      try {
        await getJson("/api/model-server/status");
        setModelServerStatus("online");
      } catch {
        setModelServerStatus("offline");
      }
    };
    check();
    const t = window.setInterval(check, 15000);
    return () => window.clearInterval(t);
  }, []);

  // Poll job when generating
  useEffect(() => {
    if (!activeJobId) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const {job} = await getJson<{job: RenderJob}>(`/api/jobs/${activeJobId}`);
        if (!job) return;

        if (job.logs?.length) setProgressLogs(job.logs.slice(-30));
        setProgressLabel(job.step);

        if (job.status === "complete") {
          setProgressPct(100);
          if (job.storyboard) setStoryboard(job.storyboard);
          setVideoUrl(`/output/videos/infographic.mp4?t=${Date.now()}`);
          window.clearInterval(pollRef.current!);
          setActiveJobId(null);
          window.setTimeout(() => setScreen("preview"), 600);
        } else if (job.status === "failed") {
          setProgressPct(100);
          setProgressError(job.error ?? "Generation failed.");
          window.clearInterval(pollRef.current!);
          setActiveJobId(null);
        } else {
          // estimate progress from step label
          const lbl = job.step.toLowerCase();
          setProgressPct(
            lbl.includes("llm") ? 18 :
            lbl.includes("narration") || lbl.includes("tts") || lbl.includes("speech") ? 42 :
            lbl.includes("music") ? 60 :
            lbl.includes("render") || lbl.includes("mp4") ? 80 : 32,
          );
        }
      } catch {/* ignore poll errors */}
    }, 1800);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [activeJobId]);

  const patch = (p: Partial<GenerationSettings>) => setSettings(c => ({...c, ...p}));
  const patchLlm = (p: Partial<LlmSettings>) => setSettings(c => ({...c, llm: {...c.llm, ...p}}));

  const canGenerate = settings.prompt.trim().length > 3;

  const generate = async () => {
    if (!canGenerate) return;
    setScreen("progress");
    setProgressPct(0);
    setProgressLabel("Queuing generation…");
    setProgressError("");
    setProgressLogs(["Prompt received", `LLM: ${settings.llm.provider === "ollama" ? settings.llm.ollamaModel : "built-in"}`, `Music: ${settings.musicModel}`, `Voice: ${settings.speechVoice}`, `Model server: ${modelServerStatus}`]);

    try {
      const topic = settings.prompt.trim().replace(/^(make|create|generate)\s+(a|an)?\s*/i, "").slice(0, 110) || settings.prompt.trim();
      const {job} = await postJson<{job: RenderJob}>("/api/generate-video", {
        topic,
        audience: settings.audience,
        tone: "bold",
        aspectRatio: settings.aspectRatio,
        llm: settings.llm,
        musicModel: settings.musicModel,
        speechVoice: settings.speechVoice,
        scale: settings.renderScale,
      }, 15000);
      setProgressLabel("LLM generating storyboard");
      setProgressPct(10);
      setActiveJobId(job.id);
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : String(err));
      setProgressLabel("Failed to start");
      setProgressPct(100);
    }
  };

  // ---- COMPOSE SCREEN ----
  if (screen === "compose") return (
    <main className="shell">
      <header className="top-rail">
        <span className="logo">Presently</span>
        <div className={`server-badge server-badge--${modelServerStatus}`}>
          <span />
          {modelServerStatus === "online" ? "Model server online" :
           modelServerStatus === "offline" ? "Model server offline — run run_model_server.ps1" :
           "Checking model server…"}
        </div>
      </header>

      <div className="compose-body">
        <div className="prompt-card">
          <label className="prompt-label">
            <span>What should this video explain?</span>
            <textarea
              id="prompt-input"
              value={settings.prompt}
              onChange={e => patch({prompt: e.target.value})}
              placeholder="E.g. The history of space exploration, for high school students"
              rows={4}
              autoFocus
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate(); }}
            />
          </label>

          <div className="control-grid">
            <label>
              Audience
              <input value={settings.audience} onChange={e => patch({audience: e.target.value})} placeholder="curious viewers, students…" />
            </label>

            <label>
              Format
              <select value={settings.aspectRatio} onChange={e => patch({aspectRatio: e.target.value as AspectRatio})}>
                <option value="16:9">Wide 16:9</option>
                <option value="9:16">Vertical 9:16</option>
                <option value="1:1">Square 1:1</option>
              </select>
            </label>

            <label>
              LLM model
              <select value={settings.llm.provider === "mock" ? "mock" : settings.llm.ollamaModel}
                onChange={e => {
                  if (e.target.value === "mock") { patchLlm({provider: "mock"}); return; }
                  patchLlm({provider: "ollama", ollamaModel: e.target.value});
                }}>
                <option value="mock">Built-in (offline / fast)</option>
                <option value="qwen2.5:7b">Qwen 2.5 7B — recommended</option>
                <option value="qwen2.5:3b">Qwen 2.5 3B — faster</option>
                <option value="mistral:7b">Mistral 7B</option>
                <option value="llama3.2:3b">Llama 3.2 3B</option>
                <option value="gemma3:4b">Gemma 3 4B</option>
              </select>
            </label>

            <label>
              Music
              <select value={settings.musicModel} onChange={e => patch({musicModel: e.target.value as MusicModel})}>
                <option value="placeholder">Synth placeholder</option>
                <option value="musicgen">MusicGen (model server)</option>
              </select>
            </label>

            <label>
              Narrator voice
              <select value={settings.speechVoice} onChange={e => patch({speechVoice: e.target.value as TtsVoice})}>
                {ttsVoices.map(v => <option key={v} value={v}>{VOICE_LABELS[v]}</option>)}
              </select>
            </label>

            <label>
              Render quality
              <select value={settings.renderScale} onChange={e => patch({renderScale: Number(e.target.value)})}>
                <option value={0.35}>Draft (RTX 2060 fast)</option>
                <option value={0.5}>Preview</option>
                <option value={1}>Final</option>
              </select>
            </label>
          </div>

          <button className="generate-btn" disabled={!canGenerate} onClick={generate} id="generate-button">
            Generate video
            <kbd>⌘ Enter</kbd>
          </button>

          {settings.llm.provider === "ollama" && (
            <p className="hint">
              Make sure <code>ollama run {settings.llm.ollamaModel}</code> is running.
              {modelServerStatus === "offline" && " Start run_model_server.ps1 for narration + music."}
            </p>
          )}
        </div>
      </div>
    </main>
  );

  // ---- PROGRESS SCREEN ----
  if (screen === "progress") return (
    <main className="shell shell--dark" aria-live="polite">
      <div className="progress-stage">
        <div className="progress-card">
          <p className="progress-pre">{progressError ? "Needs attention" : "Creating your video"}</p>
          <h1 className="progress-label">{progressLabel}</h1>
          <div className="progress-track">
            <span className="progress-fill" style={{width: `${progressPct}%`}} />
          </div>
          <p className="progress-pct">{progressPct}%</p>

          <div className="progress-log" aria-label="Generation log">
            {progressLogs.map((line, i) => <span key={i}>{line}</span>)}
          </div>

          {progressError && (
            <div className="progress-error">
              <strong>{progressError}</strong>
              <button type="button" onClick={() => setScreen("compose")}>Adjust prompt</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );

  // ---- PREVIEW SCREEN ----
  return (
    <main className="shell shell--dark">
      <header className="top-rail">
        <button type="button" className="text-btn" onClick={() => setScreen("compose")}>← New video</button>
        <span className="logo-small">{storyboard.title}</span>
        <a className="download-btn" href="/output/videos/infographic.mp4" download>Download MP4</a>
      </header>

      <div className="preview-stage">
        <video key={videoUrl} src={videoUrl} controls autoPlay playsInline />
      </div>

      <footer className="preview-meta">
        <span>{storyboard.aspectRatio}</span>
        <span>{storyboard.scenes.length} scenes</span>
        <span>{storyboard.fontFamily} font</span>
        <span>Voice: {VOICE_LABELS[storyboard.speechVoice ?? "af_heart"]}</span>
        <span>{storyboard.musicPrompt.slice(0, 60)}…</span>
      </footer>
    </main>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
