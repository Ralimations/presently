import {Audio, Sequence, interpolate, staticFile, useCurrentFrame} from "remotion";
import type {CSSProperties} from "react";
import {Circle, Star, Triangle as RemotionTriangle} from "@remotion/shapes";
import {Scene, Storyboard, FPS, BackgroundStyle, LayoutMode} from "../storyboard/schema";
import "./video.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HEADLINE_SIZE: Record<string, string> = {
  xl: "clamp(36px,4vw,68px)",
  "2xl": "clamp(44px,5vw,82px)",
  "3xl": "clamp(52px,5.6vw,96px)",
  "4xl": "clamp(62px,6.5vw,116px)",
  display: "clamp(74px,8vw,140px)",
};

const BODY_SIZE: Record<string, string> = {
  sm: "clamp(16px,1.4vw,26px)",
  md: "clamp(19px,1.65vw,32px)",
  lg: "clamp(22px,2vw,38px)",
};

const FONT_FAMILY: Record<string, string> = {
  grotesk: '"Space Grotesk Variable",Verdana,Geneva,sans-serif',
  serif: '"Newsreader Variable",Georgia,serif',
  mono: '"JetBrains Mono Variable",Consolas,"Courier New",monospace',
  condensed: '"Oswald Variable",Impact,Haettenschweiler,sans-serif',
  humanist: '"Archivo Variable","Trebuchet MS",Verdana,sans-serif',
};

const HEADLINE_FONT: Record<string, string> = {
  grotesk: '"Space Grotesk Variable",Verdana,Geneva,sans-serif',
  serif: '"Playfair Display Variable",Georgia,serif',
  mono: '"JetBrains Mono Variable",Consolas,monospace',
  condensed: '"Oswald Variable",Impact,sans-serif',
  humanist: '"Archivo Variable","Trebuchet MS",sans-serif',
};

// ---------------------------------------------------------------------------
// Background builder
// ---------------------------------------------------------------------------
const buildBackground = (bg: BackgroundStyle): string => {
  if (bg.type === "solid") return bg.primary;
  if (bg.type === "gradient") {
    return `linear-gradient(${bg.angle ?? 135}deg, ${bg.primary}, ${bg.secondary ?? bg.primary})`;
  }
  if (bg.type === "radial") {
    return `radial-gradient(ellipse at 30% 30%, ${bg.secondary ?? bg.primary} 0%, ${bg.primary} 70%)`;
  }
  // noise-gradient
  return `linear-gradient(${bg.angle ?? 145}deg, ${bg.primary}, ${bg.secondary ?? bg.primary})`;
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
const cameraPower = {subtle: 1, medium: 1.65, strong: 2.35} satisfies Record<Scene["camera"]["intensity"], number>;
const cameraOrigin = {
  headline: "32% 44%", visual: "72% 52%", stat: "72% 56%",
  center: "50% 50%", left: "28% 50%", right: "72% 50%",
} satisfies Record<Scene["camera"]["focus"], string>;

const cameraTransform = (scene: Scene, frame: number): string => {
  const power = cameraPower[scene.camera.intensity];
  const slow = interpolate(frame, [0, scene.durationSeconds * FPS], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const pop = interpolate(frame, [0, 16, 42], [0, 1, 0.18], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const wobble = Math.sin(frame / 9) * power;
  switch (scene.camera.move) {
    case "push-in":    return `scale(${1 + slow * 0.055 * power})`;
    case "pull-back":  return `scale(${1.08 + (1 - slow) * 0.035 * power})`;
    case "pan-left":   return `scale(${1 + 0.025 * power}) translateX(${slow * -34 * power}px)`;
    case "pan-right":  return `scale(${1 + 0.025 * power}) translateX(${slow * 34 * power}px)`;
    case "tilt-up":    return `scale(${1 + 0.018 * power}) translateY(${(1 - slow) * 30 * power}px)`;
    case "focus-pop":  return `scale(${1 + pop * 0.045 * power})`;
    case "orbit":      return `scale(${1 + 0.02 * power}) translate(${Math.sin(slow * Math.PI * 2) * 18 * power}px, ${Math.cos(slow * Math.PI * 2) * 12 * power}px)`;
    case "handheld":   return `scale(${1 + 0.025 * power}) translate(${wobble}px, ${Math.cos(frame / 11) * power}px) rotate(${Math.sin(frame / 17) * 0.18 * power}deg)`;
    default:           return "none";
  }
};

// ---------------------------------------------------------------------------
// Motion / Transition
// ---------------------------------------------------------------------------
const motionTransform = (motion: Scene["motion"], frame: number): string => {
  const rise = interpolate(frame, [0, 24], [38, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const slide = interpolate(frame, [0, 24], [70, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const scale = interpolate(frame, [0, 28], [0.94, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const drift = interpolate(frame, [0, 280], [-12, 12], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  switch (motion) {
    case "slide-left": return `translateX(${slide}px)`;
    case "zoom":       return `scale(${scale})`;
    case "wipe":       return `translateY(${rise * 0.45}px) scale(${scale})`;
    case "drift":      return `translate(${drift}px, ${rise * 0.25}px)`;
    default:           return `translateY(${rise}px)`;
  }
};

const transitionClip = (t: Scene["transition"], frame: number): string | undefined => {
  const p = interpolate(frame, [0, 22], [0, 100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  if (t === "iris") return `circle(${p}% at 50% 50%)`;
  if (t === "wipe") return `inset(0 ${100 - p}% 0 0)`;
  return undefined;
};

const transitionFilter = (t: Scene["transition"], frame: number): string | undefined => {
  if (t !== "blur") return undefined;
  return `blur(${interpolate(frame, [0, 24], [16, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`;
};

// ---------------------------------------------------------------------------
// Accent shape
// ---------------------------------------------------------------------------
const AccentShape = ({scene}: {scene: Scene}) => {
  const shape = scene.accentShape ?? "circle";
  const pos = scene.accentPosition ?? "top-right";
  if (shape === "none" || pos === "none") return null;

  const posStyle: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    opacity: 0.15,
    ...(pos === "top-right"    ? {top: "-80px", right: "-80px"} :
        pos === "bottom-left"  ? {bottom: "-80px", left: "-80px"} :
                                 {top: "50%", left: "50%", transform: "translate(-50%,-50%)"}),
  };

  const pathStyle = {fill: "var(--accent)"};
  if (shape === "triangle") return <div style={posStyle}><RemotionTriangle length={480} direction="up" pathStyle={pathStyle} /></div>;
  if (shape === "star")     return <div style={posStyle}><Star innerRadius={120} outerRadius={260} points={8} pathStyle={pathStyle} /></div>;
  return <div style={posStyle}><Circle radius={240} pathStyle={pathStyle} /></div>;
};

// ---------------------------------------------------------------------------
// Visual elements
// ---------------------------------------------------------------------------
const BarChart = ({scene, frame}: {scene: Scene; frame: number}) => {
  const data = scene.chartData ?? [{label: "Signal", value: 68}, {label: "Action", value: 84}, {label: "Clarity", value: 56}];
  return (
    <div className="v-bars">
      {data.map((item, i) => {
        const w = interpolate(frame, [18 + i * 6, 58 + i * 6], [0, item.value], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        const op = interpolate(frame, [8 + i * 5, 22 + i * 5], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        return (
          <div className="v-barRow" key={item.label} style={{opacity: op}}>
            <span>{item.label}</span>
            <div className="v-barTrack"><div className="v-barFill" style={{width: `${w}%`}} /></div>
            <strong>{Math.round(w)}</strong>
          </div>
        );
      })}
    </div>
  );
};

const KineticText = ({scene, frame}: {scene: Scene; frame: number}) => {
  const words = scene.keywords ?? scene.headline.split(/\s+/).slice(0, 5);
  return (
    <div className="v-kinetic">
      {words.map((word, i) => {
        const enter = interpolate(frame, [10 + i * 7, 25 + i * 7], [28, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        const s = interpolate(frame, [10 + i * 7, 25 + i * 7], [0.78, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        return <span key={`${word}-${i}`} style={{opacity: s, transform: `translateY(${enter}px) scale(${s})`}}>{word}</span>;
      })}
    </div>
  );
};

const Timeline = ({scene, frame}: {scene: Scene; frame: number}) => {
  const steps = scene.keywords ?? ["Frame", "Signal", "Action"];
  return (
    <div className="v-timeline">
      {steps.slice(0, 4).map((step, i) => (
        <div className="v-step" key={step} style={{opacity: interpolate(frame, [10 + i * 10, 28 + i * 10], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
        </div>
      ))}
    </div>
  );
};

const Comparison = ({scene, frame}: {scene: Scene; frame: number}) => (
  <div className="v-compare">
    <div style={{transform: `translateX(${interpolate(frame, [8, 34], [-44, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`}}>
      <span>Before</span><strong>{scene.compare?.left ?? "Old approach"}</strong>
    </div>
    <div style={{transform: `translateX(${interpolate(frame, [18, 44], [44, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`}}>
      <span>After</span><strong>{scene.compare?.right ?? "New approach"}</strong>
    </div>
  </div>
);

const Diagram = ({scene, frame}: {scene: Scene; frame: number}) => {
  const nodes = scene.keywords ?? ["input", "signal", "decision"];
  return (
    <div className="v-diagram">
      {nodes.slice(0, 4).map((node, i) => (
        <div className="v-node" key={node} style={{
          opacity: interpolate(frame, [12 + i * 10, 28 + i * 10], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
          transform: `translateY(${interpolate(frame, [12 + i * 10, 32 + i * 10], [34, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`,
        }}>
          <div className="v-nodeNum">{i + 1}</div>
          <strong>{node}</strong>
        </div>
      ))}
    </div>
  );
};

const StatWall = ({scene, frame}: {scene: Scene; frame: number}) => {
  const data = scene.chartData ?? [{label: "signal", value: 68}, {label: "speed", value: 82}, {label: "trust", value: 70}, {label: "reach", value: 64}];
  return (
    <div className="v-statWall">
      {data.slice(0, 4).map((item, i) => {
        const val = interpolate(frame, [18 + i * 5, 58 + i * 5], [0, item.value], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        return (
          <div className="v-statTile" key={item.label} style={{transform: `scale(${interpolate(frame, [8 + i * 8, 28 + i * 8], [0.86, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})})`}}>
            <strong>{Math.round(val)}</strong><span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const HeroStat = ({scene}: {scene: Scene}) => (
  <div className="v-heroStat">
    <strong>{scene.stat ?? "∞"}</strong>
    {scene.eyebrow && <span>{scene.eyebrow}</span>}
  </div>
);

const QuoteMark = () => <div className="v-quote">"</div>;

const VisualElement = ({scene, frame}: {scene: Scene; frame: number}) => {
  switch (scene.visualType) {
    case "bar-chart":    return <BarChart scene={scene} frame={frame} />;
    case "kinetic-text": return <KineticText scene={scene} frame={frame} />;
    case "timeline":     return <Timeline scene={scene} frame={frame} />;
    case "comparison":   return <Comparison scene={scene} frame={frame} />;
    case "diagram":      return <Diagram scene={scene} frame={frame} />;
    case "stat-wall":    return <StatWall scene={scene} frame={frame} />;
    case "hero-stat":    return <HeroStat scene={scene} />;
    case "quote":        return <QuoteMark />;
    case "none":         return null;
    default:             return <HeroStat scene={scene} />;
  }
};

// ---------------------------------------------------------------------------
// Layout grid
// ---------------------------------------------------------------------------
const LAYOUT_GRID: Record<LayoutMode, CSSProperties> = {
  "centered":        {gridTemplateColumns: "1fr", textAlign: "center", justifyItems: "center"},
  "split-left":      {gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)"},
  "split-right":     {gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.1fr)"},
  "fullscreen-text": {gridTemplateColumns: "1fr"},
  "data-focus":      {gridTemplateColumns: "minmax(0,0.45fr) minmax(0,1.55fr)"},
  "asymmetric":      {gridTemplateColumns: "minmax(0,0.7fr) minmax(0,1.3fr)", alignItems: "end"},
};

const LAYOUT_VISUAL_ORDER: Record<LayoutMode, number> = {
  "centered": 2, "split-left": 2, "split-right": 1,
  "fullscreen-text": 99, "data-focus": 2, "asymmetric": 2,
};

// ---------------------------------------------------------------------------
// Scene card
// ---------------------------------------------------------------------------
const SceneCard = ({scene, storyboard, index}: {scene: Scene; storyboard: Storyboard; index: number}) => {
  const frame = useCurrentFrame();
  const bg = scene.backgroundStyle ?? storyboard.globalBackground;
  const typo = scene.typography ?? {headlineSize: "3xl", headlineWeight: "900", headlineTransform: "uppercase", bodySize: "md"};
  const fontFamily = FONT_FAMILY[storyboard.fontFamily] ?? FONT_FAMILY.grotesk;
  const headlineFont = HEADLINE_FONT[storyboard.fontFamily] ?? HEADLINE_FONT.grotesk;

  const fade = interpolate(frame, [0, 18], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const push = scene.transition === "push" ? interpolate(frame, [0, 24], [42, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : 0;
  const rotate = scene.transition === "flip" ? interpolate(frame, [0, 24], [-8, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : 0;
  const progress = interpolate(frame, [0, scene.durationSeconds * FPS], [0, 100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});

  const layoutMode = scene.layoutMode ?? "split-left";
  const visualOrder = LAYOUT_VISUAL_ORDER[layoutMode];
  const showVisual = layoutMode !== "fullscreen-text";

  // Narration audio — scene-01.wav, scene-02.wav, etc.
  const narrationPath = `output/speech/scene-${String(index + 1).padStart(2, "0")}.wav`;

  return (
    <section
      className="sc"
      style={{
        background: buildBackground(bg),
        fontFamily,
        opacity: fade,
        transform: `${motionTransform(scene.motion, frame)} translateX(${push}px) rotateY(${rotate}deg)`,
        clipPath: transitionClip(scene.transition, frame),
        filter: transitionFilter(scene.transition, frame),
      }}
    >
      <div
        className="sc-camera"
        style={{
          transform: cameraTransform(scene, frame),
          transformOrigin: cameraOrigin[scene.camera.focus],
        }}
      >
        <AccentShape scene={scene} />

        {/* Progress bar */}
        <div className="sc-progress"><span style={{width: `${progress}%`}} /></div>

        {/* Eyebrow */}
        <div className="sc-eyebrow">{scene.eyebrow}</div>

        {/* Content grid */}
        <div className="sc-grid" style={LAYOUT_GRID[layoutMode]}>
          <div className="sc-copy" style={{order: 1}}>
            <h1 style={{
              fontFamily: headlineFont,
              fontSize: HEADLINE_SIZE[typo.headlineSize],
              fontWeight: typo.headlineWeight,
              textTransform: (typo.headlineTransform ?? "uppercase") as CSSProperties["textTransform"],
            }}>
              {scene.headline}
            </h1>
            <p style={{fontSize: BODY_SIZE[typo.bodySize]}}>{scene.body}</p>
            {scene.stat && <div className="sc-stat">{scene.stat}</div>}
          </div>

          {showVisual && (
            <div className="sc-visual" style={{order: visualOrder}}>
              <VisualElement scene={scene} frame={frame} />
            </div>
          )}
        </div>
      </div>

      {/* Per-scene TTS narration */}
      <Audio src={staticFile(narrationPath)} volume={0.92} />
    </section>
  );
};

// ---------------------------------------------------------------------------
// Root composition
// ---------------------------------------------------------------------------
const getSceneStart = (scenes: Scene[], i: number) =>
  scenes.slice(0, i).reduce((sum, s) => sum + s.durationSeconds * FPS, 0);

// Music — server always writes generated.wav (real or copied from placeholder)
const MUSIC_SRC = staticFile("output/music/generated.wav");

export const InfographicMinute = (storyboard: Storyboard) => {
  return (
    <main
      className="video"
      style={{
        "--bg": storyboard.palette.background,
        "--fg": storyboard.palette.foreground,
        "--accent": storyboard.palette.accent,
        "--secondary": storyboard.palette.secondary,
        background: buildBackground(storyboard.globalBackground),
        fontFamily: FONT_FAMILY[storyboard.fontFamily],
        color: storyboard.palette.foreground,
      } as CSSProperties}
    >
      {/* Title rail */}
      <div className="title-rail">
        <span>{storyboard.title}</span>
        <span>{storyboard.audience}</span>
      </div>

      {/* Scenes */}
      {storyboard.scenes.map((scene, i) => (
        <Sequence key={scene.id} from={getSceneStart(storyboard.scenes, i)} durationInFrames={scene.durationSeconds * FPS}>
          <SceneCard scene={scene} storyboard={storyboard} index={i} />
        </Sequence>
      ))}

      {/* Background music */}
      <Audio src={MUSIC_SRC} volume={0.18} />
    </main>
  );
};
