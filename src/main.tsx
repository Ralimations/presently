import {StrictMode, useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {Player} from "@remotion/player";
import {InfographicMinute} from "./remotion/InfographicMinute";
import {generateStoryboard, StoryboardInput} from "./storyboard/generateStoryboard";
import {
  AspectRatio,
  FPS,
  Storyboard,
  TARGET_DURATION_FRAMES,
  Tone,
  getDimensions,
} from "./storyboard/schema";
import "./styles.css";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

type AppMode = "preview" | "renders" | "settings";
type RenderStatus = {
  label: string;
  busy: boolean;
  error?: string;
};

type RenderJob = {
  id: string;
  type: string;
  status: "queued" | "running" | "complete" | "failed";
  step: string;
  error?: string;
};

type ProjectSummary = {
  id: string;
  title: string;
  topic: string;
  aspectRatio: string;
  updatedAt?: string;
};

type PerformanceSettings = {
  previewScale: number;
  stillScale: number;
  renderScale: number;
};

type LlmSettings = {
  provider: "mock" | "ollama";
  ollamaModel: string;
  ollamaUrl: string;
};

const initialInput: StoryboardInput = {
  topic: "AI-generated one-minute explainers",
  audience: "founders and content teams",
  tone: "bold",
  aspectRatio: "16:9",
  sources: "",
};

const initialStoryboard = generateStoryboard(initialInput);
const storageKeys = {
  generation: "presently:generation-settings",
  performance: "presently:performance-settings",
  llm: "presently:llm-settings",
};

const loadStoredSettings = <Settings,>(key: string, fallback: Settings): Settings => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? {...fallback, ...JSON.parse(raw)} : fallback;
  } catch {
    return fallback;
  }
};

const inferPromptInput = (
  prompt: string,
  current: Storyboard,
): StoryboardInput => {
  const normalized = prompt.toLowerCase();
  const tone: Tone = normalized.includes("cinematic")
    ? "cinematic"
    : normalized.includes("academic")
      ? "academic"
      : normalized.includes("startup")
        ? "startup"
        : normalized.includes("clear")
          ? "clear"
          : normalized.includes("bold")
            ? "bold"
            : current.tone;
  const aspectRatio: AspectRatio =
    normalized.includes("vertical") ||
    normalized.includes("shorts") ||
    normalized.includes("tiktok") ||
    normalized.includes("reel")
      ? "9:16"
      : normalized.includes("square")
        ? "1:1"
        : normalized.includes("wide") || normalized.includes("youtube")
          ? "16:9"
          : current.aspectRatio;
  const audienceMatch = prompt.match(/(?:for|audience:)\s+([^,.]+)/i);
  const topic = prompt
    .replace(/^(make|generate|create|build)\s+(a|an)?\s*/i, "")
    .replace(/\b(one[- ]minute|60[- ]second|infographic|video|presentation)\b/gi, "")
    .replace(/\b(for|audience:)\s+[^,.]+/i, "")
    .trim();

  return {
    topic: topic || current.topic,
    audience: audienceMatch?.[1]?.trim() || current.audience,
    tone,
    aspectRatio,
    sources: prompt,
  };
};

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const postJson = async <Response,>(url: string, body: unknown = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Response & {ok?: boolean; error?: string};

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
};

const deleteJson = async <Response,>(url: string) => {
  const response = await fetch(url, {method: "DELETE"});
  const data = (await response.json()) as Response & {ok?: boolean; error?: string};

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
};

const getJson = async <Response,>(url: string) => {
  const response = await fetch(url);
  const data = (await response.json()) as Response & {ok?: boolean; error?: string};

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
};

const App = () => {
  const [storyboard, setStoryboard] = useState<Storyboard>(initialStoryboard);
  const [generationSettings, setGenerationSettings] =
    useState<Pick<StoryboardInput, "audience" | "tone" | "aspectRatio">>(() =>
      loadStoredSettings(storageKeys.generation, {
        audience: initialInput.audience,
        tone: initialInput.tone,
        aspectRatio: initialInput.aspectRatio,
      }),
    );
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AppMode>("preview");
  const [renderStatus, setRenderStatus] = useState<RenderStatus>({
    label: "Ready",
    busy: false,
  });
  const [videoUrl, setVideoUrl] = useState("/output/videos/infographic.mp4");
  const [stillUrl, setStillUrl] = useState("/output/stills/frame.png");
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>(() =>
    loadStoredSettings(storageKeys.performance, {
      previewScale: 0.55,
      stillScale: 0.25,
      renderScale: 1,
    }),
  );
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() =>
    loadStoredSettings(storageKeys.llm, {
      provider: "mock",
      ollamaModel: "qwen3:0.6b",
      ollamaUrl: "http://localhost:11434",
    }),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Describe the video you want. I will turn it into a validated 60-second Remotion storyboard that you can preview, edit, and render.",
    },
  ]);
  const dimensions = getDimensions(storyboard.aspectRatio);
  const previewWidth = Math.round(dimensions.width * performanceSettings.previewScale);
  const previewHeight = Math.round(dimensions.height * performanceSettings.previewScale);
  const storyboardJson = useMemo(
    () => JSON.stringify(storyboard, null, 2),
    [storyboard],
  );

  const refreshJobs = async () => {
    const response = await getJson<{jobs: RenderJob[]}>("/api/jobs");
    setJobs(response.jobs);

    const active = response.jobs.find(
      (job) => job.status === "queued" || job.status === "running",
    );
    const latest = response.jobs[0];

    if (active) {
      setRenderStatus({label: `${active.type}: ${active.step}`, busy: true});
      return;
    }

    if (latest?.status === "failed") {
      setRenderStatus({label: latest.step, busy: false, error: latest.error});
      return;
    }

    if (latest?.status === "complete") {
      setRenderStatus({label: `${latest.type} complete`, busy: false});
      setVideoUrl(`/output/videos/infographic.mp4?t=${Date.now()}`);
      setStillUrl(`/output/stills/frame.png?t=${Date.now()}`);
      if (latest.type === "thumbnails") {
        void refreshThumbnails();
      }
    }
  };

  const refreshProjects = async () => {
    const response = await getJson<{projects: ProjectSummary[]}>("/api/projects");
    setProjects(response.projects);
  };

  const refreshThumbnails = async () => {
    const response = await getJson<{thumbnails: string[]}>("/api/thumbnails");
    setThumbnails(response.thumbnails.map((url) => `${url}?t=${Date.now()}`));
  };

  const applyStoryboard = (nextStoryboard: Storyboard) => {
    setStoryboard(nextStoryboard);
    setGenerationSettings({
      audience: nextStoryboard.audience,
      tone: nextStoryboard.tone,
      aspectRatio: nextStoryboard.aspectRatio,
    });
    setMode("preview");
  };

  useEffect(() => {
    void refreshProjects();
    void refreshJobs();
    void refreshThumbnails();

    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 2000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.generation, JSON.stringify(generationSettings));
  }, [generationSettings]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.performance, JSON.stringify(performanceSettings));
  }, [performanceSettings]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.llm, JSON.stringify(llmSettings));
  }, [llmSettings]);

  const generateFromPrompt = async () => {
    if (!prompt.trim()) {
      return;
    }

    const inferred = inferPromptInput(prompt, {
      ...storyboard,
      audience: generationSettings.audience,
      tone: generationSettings.tone,
      aspectRatio: generationSettings.aspectRatio,
    });
    const nextInput: StoryboardInput = {
      ...inferred,
      audience: inferred.audience || generationSettings.audience,
      sources: prompt,
    };

    setRenderStatus({label: "Generating video plan", busy: true});

    try {
      const response = await postJson<{storyboard: Storyboard}>(
        "/api/storyboard",
        {
          ...nextInput,
          llm: llmSettings,
        },
      );
      applyStoryboard(response.storyboard);
      setMessages((current) => [
        ...current,
        {id: Date.now(), role: "user", content: prompt},
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            llmSettings.provider === "ollama"
              ? `Generated with local Ollama model ${llmSettings.ollamaModel}, then validated for Remotion.`
              : "Generated the pages, layouts, transitions, copy, and music prompt automatically. Preview it or render the MP4.",
        },
      ]);
      setPrompt("");
      setRenderStatus({label: "Video plan ready", busy: false});
      void refreshProjects();
    } catch (error) {
      const fallbackStoryboard = generateStoryboard(nextInput);
      applyStoryboard(fallbackStoryboard);
      setMessages((current) => [
        ...current,
        {id: Date.now(), role: "user", content: prompt},
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "Generated locally because the app server was unavailable. Start with run_presently.ps1 for rendering.",
        },
      ]);
      setPrompt("");
      setRenderStatus({
        label: "Generated locally",
        busy: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const patchStoryboard = (patch: Partial<Storyboard>) => {
    setStoryboard((current) => ({...current, ...patch}));
  };

  const renderCommand =
    "Outputs are generated by the local web app API.";

  const runAction = async (
    label: string,
    action: () => Promise<{url?: string} | void>,
  ) => {
    setRenderStatus({label, busy: true});

    try {
      const result = await action();
      setRenderStatus({label: `${label} complete`, busy: false});
      return result;
    } catch (error) {
      setRenderStatus({
        label,
        busy: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  };

  const saveStoryboard = async () =>
    runAction("Saving storyboard", async () => {
      await postJson("/api/storyboard/save", {storyboard});
      await refreshProjects();
    });

  const createMusic = async () =>
    runAction("Queueing music", async () => {
      await postJson("/api/music");
      await refreshJobs();
    });

  const renderStill = async () => {
    await saveStoryboard();
    await runAction("Queueing still", async () => {
      await postJson("/api/still", {scale: performanceSettings.stillScale});
      await refreshJobs();
    });
  };

  const renderThumbnails = async () => {
    await saveStoryboard();
    await runAction("Queueing thumbnails", async () => {
      await postJson("/api/thumbnails", {scale: performanceSettings.stillScale});
      await refreshJobs();
    });
  };

  const renderVideo = async () => {
    await saveStoryboard();
    await runAction("Queueing video", async () => {
      await postJson("/api/render", {scale: performanceSettings.renderScale});
      await refreshJobs();
    });
  };

  const loadProject = async (project: ProjectSummary) =>
    runAction("Loading project", async () => {
      const response = await postJson<{storyboard: Storyboard}>(
        `/api/projects/${encodeURIComponent(project.id)}/load`,
      );
      applyStoryboard(response.storyboard);
      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          role: "assistant",
          content: `Loaded "${response.storyboard.title}".`,
        },
      ]);
    });

  const duplicateProject = async (project: ProjectSummary) =>
    runAction("Duplicating project", async () => {
      const response = await postJson<{storyboard: Storyboard}>(
        `/api/projects/${encodeURIComponent(project.id)}/duplicate`,
      );
      applyStoryboard(response.storyboard);
      await refreshProjects();
      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          role: "assistant",
          content: `Duplicated and opened "${response.storyboard.title}".`,
        },
      ]);
    });

  const deleteProject = async (project: ProjectSummary) => {
    if (!window.confirm(`Delete "${project.title}" from project history?`)) {
      return;
    }

    await runAction("Deleting project", async () => {
      await deleteJson(`/api/projects/${encodeURIComponent(project.id)}`);
      await refreshProjects();
    });
  };

  return (
    <div className="appShell">
      <aside className="chatPanel">
        <div className="brandBlock">
          <div>
            <p className="eyebrow">Presently</p>
            <h1>Create a video</h1>
          </div>
        </div>

        <div className="messages">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <span>{message.role === "assistant" ? "Assistant" : "You"}</span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>

        <div className="promptBox">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Make a 60-second video about urban farming for city planners..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                generateFromPrompt();
              }
            }}
          />
          <button type="button" onClick={generateFromPrompt}>
            Generate
          </button>
          <small>Ctrl/⌘ + Enter to generate.</small>
        </div>
      </aside>

      <main className="studioPanel">
        <header className="topBar">
          <div>
            <p className="eyebrow">Preview</p>
            <h2>{storyboard.title}</h2>
          </div>
          <nav className="modeTabs" aria-label="Studio modes">
            {(["preview", "renders", "settings"] as const).map((tab) => (
              <button
                className={mode === tab ? "active" : ""}
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {mode === "preview" && (
          <section className="previewLayout">
            <div className="playerFrame">
              <Player
                component={InfographicMinute}
                inputProps={storyboard}
                durationInFrames={TARGET_DURATION_FRAMES}
                fps={FPS}
                compositionWidth={previewWidth}
                compositionHeight={previewHeight}
                controls
                style={{
                  width: "100%",
                  aspectRatio: `${previewWidth}/${previewHeight}`,
                }}
              />
            </div>
            <div className="thumbnailStrip">
              {thumbnails.length === 0 ? (
                <p className="emptyState">Render thumbnails to preview scenes quickly.</p>
              ) : (
                thumbnails.map((thumbnail, index) => (
                  <img src={thumbnail} alt={`Scene ${index + 1}`} key={thumbnail} />
                ))
              )}
            </div>
            <div className="summaryGrid">
              <article>
                <span>Format</span>
                <strong>{storyboard.aspectRatio}</strong>
              </article>
              <article>
                <span>Duration</span>
                <strong>60 sec</strong>
              </article>
              <article>
                <span>Scenes</span>
                <strong>{storyboard.scenes.length}</strong>
              </article>
              <article>
                <span>Music</span>
                <strong>{storyboard.artDirection}</strong>
              </article>
            </div>
          </section>
        )}

        {mode === "settings" && (
          <section className="settingsLayout">
            <div className="editorCard">
              <p className="eyebrow">Generation defaults</p>
              <label>
                Audience
                <input
                  value={generationSettings.audience}
                  onChange={(event) =>
                    setGenerationSettings((current) => ({
                      ...current,
                      audience: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Title
                <input
                  value={storyboard.title}
                  onChange={(event) => patchStoryboard({title: event.target.value})}
                />
              </label>
              <div className="split">
                <label>
                  Tone
                  <select
                    value={generationSettings.tone}
                    onChange={(event) =>
                      setGenerationSettings((current) => ({
                        ...current,
                        tone: event.target.value as Tone,
                      }))
                    }
                  >
                    {(["bold", "clear", "academic", "startup", "cinematic"] as Tone[]).map(
                      (tone) => (
                        <option value={tone} key={tone}>
                          {tone}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Aspect
                  <select
                    value={generationSettings.aspectRatio}
                    onChange={(event) =>
                      setGenerationSettings((current) => ({
                        ...current,
                        aspectRatio: event.target.value as AspectRatio,
                      }))
                    }
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
              </div>
              <div className="colorGrid">
                {(["background", "foreground", "accent", "secondary"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key}
                      <input
                        type="color"
                        value={storyboard.palette[key]}
                        onChange={(event) =>
                          patchStoryboard({
                            palette: {
                              ...storyboard.palette,
                              [key]: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <label>
                Refined site prompt
                <textarea
                  value={storyboard.refinedPrompt.sitePrompt}
                  onChange={(event) =>
                    patchStoryboard({
                      refinedPrompt: {
                        ...storyboard.refinedPrompt,
                        sitePrompt: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Music generator prompt
                <textarea
                  value={storyboard.refinedPrompt.musicPrompt}
                  onChange={(event) =>
                    patchStoryboard({
                      refinedPrompt: {
                        ...storyboard.refinedPrompt,
                        musicPrompt: event.target.value,
                      },
                      musicPrompt: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="editorCard">
              <p className="eyebrow">Automatic plan</p>
              <div className="settingsList">
                <span>Pages</span>
                <code>{storyboard.scenes.length} generated pages</code>
                <span>Layouts</span>
                <code>{[...new Set(storyboard.scenes.map((scene) => scene.layout))].join(", ")}</code>
                <span>Motion</span>
                <code>{[...new Set(storyboard.scenes.map((scene) => scene.motion))].join(", ")}</code>
                <span>Camera</span>
                <code>{[...new Set(storyboard.scenes.map((scene) => scene.camera.move))].join(", ")}</code>
                <span>Transitions</span>
                <code>{[...new Set(storyboard.scenes.map((scene) => scene.transition))].join(", ")}</code>
                <span>Storyboard</span>
                <code>output/storyboards/storyboard.json</code>
                <span>Music</span>
                <code>public/output/music/placeholder.wav</code>
                <span>Video</span>
                <code>public/output/videos/infographic.mp4</code>
              </div>
            </div>
            <div className="editorCard">
              <p className="eyebrow">Performance</p>
              <label>
                Preview scale
                <select
                  value={performanceSettings.previewScale}
                  onChange={(event) =>
                    setPerformanceSettings((current) => ({
                      ...current,
                      previewScale: Number(event.target.value),
                    }))
                  }
                >
                  <option value={0.35}>Low</option>
                  <option value={0.55}>Balanced</option>
                  <option value={0.75}>High</option>
                </select>
              </label>
              <label>
                Still and thumbnail scale
                <select
                  value={performanceSettings.stillScale}
                  onChange={(event) =>
                    setPerformanceSettings((current) => ({
                      ...current,
                      stillScale: Number(event.target.value),
                    }))
                  }
                >
                  <option value={0.12}>Fast</option>
                  <option value={0.25}>Balanced</option>
                  <option value={0.5}>Detailed</option>
                </select>
              </label>
              <label>
                MP4 render scale
                <select
                  value={performanceSettings.renderScale}
                  onChange={(event) =>
                    setPerformanceSettings((current) => ({
                      ...current,
                      renderScale: Number(event.target.value),
                    }))
                  }
                >
                  <option value={0.35}>Draft</option>
                  <option value={0.5}>Preview</option>
                  <option value={1}>Final</option>
                </select>
              </label>
            </div>
            <div className="editorCard">
              <p className="eyebrow">Local LLM</p>
              <label>
                Provider
                <select
                  value={llmSettings.provider}
                  onChange={(event) =>
                    setLlmSettings((current) => ({
                      ...current,
                      provider: event.target.value as LlmSettings["provider"],
                    }))
                  }
                >
                  <option value="mock">Built-in generator</option>
                  <option value="ollama">Ollama local</option>
                </select>
              </label>
              <label>
                Ollama model
                <input
                  value={llmSettings.ollamaModel}
                  onChange={(event) =>
                    setLlmSettings((current) => ({
                      ...current,
                      ollamaModel: event.target.value,
                    }))
                  }
                  placeholder="qwen3:0.6b"
                />
              </label>
              <label>
                Ollama API URL
                <input
                  value={llmSettings.ollamaUrl}
                  onChange={(event) =>
                    setLlmSettings((current) => ({
                      ...current,
                      ollamaUrl: event.target.value,
                    }))
                  }
                  placeholder="http://localhost:11434"
                />
              </label>
              <p className="helperText">
                Install Ollama separately, then run <code>ollama pull qwen3:0.6b</code>.
                Invalid LLM output falls back to the built-in generator.
              </p>
            </div>
            <div className="editorCard">
              <p className="eyebrow">Project history</p>
              <div className="projectList">
                {projects.length === 0 ? (
                  <p className="emptyState">No saved projects yet.</p>
                ) : (
                  projects.slice(0, 8).map((project) => (
                    <article className="projectItem" key={project.id}>
                      <div>
                        <strong>{project.title}</strong>
                        <span>{project.topic}</span>
                      </div>
                      <em>{project.aspectRatio}</em>
                      <div className="projectActions">
                        <button type="button" onClick={() => loadProject(project)}>
                          Load
                        </button>
                        <button type="button" onClick={() => duplicateProject(project)}>
                          Copy
                        </button>
                        <button
                          className="ghostDanger"
                          type="button"
                          onClick={() => deleteProject(project)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {mode === "renders" && (
          <section className="rendersLayout">
            <div className="renderedVideo">
              <p className="eyebrow">Latest video</p>
              <video src={videoUrl} controls poster={stillUrl} />
              <p>
                Render from this page. The latest MP4 appears here when the
                local app server finishes.
              </p>
            </div>
            <div className="renderActions">
              <h3>Generate</h3>
              <button type="button" onClick={saveStoryboard} disabled={renderStatus.busy}>
                Save storyboard
              </button>
              <button type="button" onClick={createMusic} disabled={renderStatus.busy}>
                Generate music
              </button>
              <button type="button" onClick={renderStill} disabled={renderStatus.busy}>
                Render still
              </button>
              <button type="button" onClick={renderThumbnails} disabled={renderStatus.busy}>
                Render thumbnails
              </button>
              <button type="button" onClick={renderVideo} disabled={renderStatus.busy}>
                Render MP4
              </button>
              <button
                type="button"
                onClick={() => downloadText("storyboard.json", storyboardJson)}
              >
                Download storyboard JSON
              </button>
              <a href="/output/videos/infographic.mp4" download>
                Download latest MP4
              </a>
              <a href="/output/stills/frame.png" download>
                Download latest still
              </a>
              <p className={renderStatus.error ? "status error" : "status"}>
                {renderStatus.error ?? renderStatus.label}
              </p>
            </div>
            <div className="jsonPane">
              <p className="eyebrow">Render queue</p>
              <div className="queueList">
                {jobs.length === 0 ? (
                  <p className="emptyState">No render jobs yet.</p>
                ) : (
                  jobs.slice(0, 8).map((job) => (
                    <article className={`queueItem ${job.status}`} key={job.id}>
                      <strong>{job.type}</strong>
                      <span>{job.step}</span>
                      <em>{job.status}</em>
                    </article>
                  ))
                )}
              </div>
            </div>
            <div className="jsonPane">
              <p className="eyebrow">Settings</p>
              <div className="settingsList">
                <span>Storyboard</span>
                <code>output/storyboards/storyboard.json</code>
                <span>Music</span>
                <code>public/output/music/placeholder.wav</code>
                <span>Still</span>
                <code>public/output/stills/frame.png</code>
                <span>Video</span>
                <code>public/output/videos/infographic.mp4</code>
                <span>Pipeline</span>
                <code>{renderCommand}</code>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
