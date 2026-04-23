import {Audio, Sequence, interpolate, staticFile, useCurrentFrame} from "remotion";
import type {CSSProperties} from "react";
import {Circle, Star, Triangle as RemotionTriangle} from "@remotion/shapes";
import {
  Activity,
  Boxes,
  CircuitBoard,
  Compass,
  Leaf,
  Map,
  Orbit,
  Sparkles,
  Target,
  Triangle as TriangleIcon,
  Zap,
  Waves,
} from "lucide-react";
import {Scene, Storyboard, FPS, SymbolName} from "../storyboard/schema";
import "./video.css";

const sceneIcons: Record<Scene["visualType"], string> = {
  "hero-stat": "01",
  timeline: "02",
  comparison: "03",
  process: "04",
  quote: "05",
  chart: "06",
  summary: "07",
  "kinetic-text": "08",
  diagram: "09",
  "stat-wall": "10",
  "before-after": "11",
  "myth-fact": "12",
  "image-collage": "13",
  map: "14",
};

const getSceneStartFrame = (scenes: Scene[], index: number) =>
  scenes
    .slice(0, index)
    .reduce((sum, scene) => sum + scene.durationSeconds * FPS, 0);

const Bars = ({scene}: {scene: Scene}) => {
  const data =
    scene.chartData ??
    [
      {label: "Signal", value: 68},
      {label: "Action", value: 84},
      {label: "Clarity", value: 56},
    ];

  return (
    <div className="bars">
      {data.map((item) => (
        <div className="barRow" key={item.label}>
          <span>{item.label}</span>
          <div className="barTrack">
            <div className="barFill" style={{width: `${item.value}%`}} />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
};

const KineticWords = ({scene}: {scene: Scene}) => {
  const words = scene.keywords ?? scene.headline.split(/\s+/).slice(0, 5);

  return (
    <div className="kineticWords">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </div>
  );
};

const Diagram = ({scene}: {scene: Scene}) => {
  const nodes = scene.keywords ?? ["input", "signal", "decision"];

  return (
    <div className="diagram">
      {nodes.slice(0, 4).map((node, index) => (
        <div className="diagramNode" key={node}>
          <SymbolMark scene={scene} />
          <strong>{node}</strong>
          {index < nodes.length - 1 ? <span className="connector" /> : null}
        </div>
      ))}
    </div>
  );
};

const StatWall = ({scene}: {scene: Scene}) => {
  const data =
    scene.chartData ??
    [
      {label: "signal", value: 68},
      {label: "speed", value: 82},
      {label: "trust", value: 70},
    ];

  return (
    <div className="statWall">
      {data.map((item) => (
        <div className="statTile" key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const BeforeAfter = ({scene}: {scene: Scene}) => (
  <div className="beforeAfter">
    <div>
      <span>Before</span>
      <strong>{scene.compare?.left ?? "Fragmented"}</strong>
    </div>
    <div>
      <span>After</span>
      <strong>{scene.compare?.right ?? "Coordinated"}</strong>
    </div>
  </div>
);

const MythFact = ({scene}: {scene: Scene}) => (
  <div className="mythFact">
    <div>
      <span>Myth</span>
      <strong>{scene.compare?.left ?? "It is only a trend"}</strong>
    </div>
    <div>
      <span>Fact</span>
      <strong>{scene.compare?.right ?? "Systems change when incentives shift"}</strong>
    </div>
  </div>
);

const ImageCollage = ({scene}: {scene: Scene}) => (
  <div className="collage">
    {(scene.keywords ?? ["source", "signal", "system", "impact"]).map((item, index) => (
      <div className={`collageTile tile-${index + 1}`} key={item}>
        <SymbolMark scene={scene} />
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const MapLike = ({scene}: {scene: Scene}) => (
  <div className="mapLike">
    <div className="mapPath" />
    {(scene.keywords ?? ["origin", "hub", "edge"]).slice(0, 4).map((item, index) => (
      <div className={`mapPin pin-${index + 1}`} key={item}>
        <span>{index + 1}</span>
        <strong>{item}</strong>
      </div>
    ))}
  </div>
);

const iconProps = {
  strokeWidth: 1.7,
  absoluteStrokeWidth: true,
};

const symbolIcons: Record<SymbolName, React.ComponentType<typeof iconProps>> = {
  spark: Sparkles,
  network: CircuitBoard,
  leaf: Leaf,
  pulse: Activity,
  map: Map,
  stack: Boxes,
  orbit: Orbit,
  signal: Compass,
  prism: TriangleIcon,
  wave: Waves,
  target: Target,
  globe: Orbit,
  bolt: Zap,
};

const SymbolMark = ({scene}: {scene: Scene}) => {
  const Icon = symbolIcons[scene.symbol];

  return (
    <div className={`symbolMark symbol-${scene.symbol}`}>
      <Icon {...iconProps} />
    </div>
  );
};

const ShapeBackdrop = ({scene}: {scene: Scene}) => {
  const pathStyle = {
    fill: "var(--accent)",
    opacity: 0.18,
  };

  if (scene.symbol === "prism" || scene.template === "cinematic-essay") {
    return (
      <RemotionTriangle
        length={520}
        direction="up"
        className="shapeBackdrop"
        pathStyle={pathStyle}
      />
    );
  }

  if (scene.symbol === "spark" || scene.template === "kinetic") {
    return (
      <Star
        innerRadius={150}
        outerRadius={290}
        points={8}
        className="shapeBackdrop"
        pathStyle={pathStyle}
      />
    );
  }

  return (
    <Circle
      radius={260}
      className="shapeBackdrop"
      pathStyle={pathStyle}
    />
  );
};

const transitionClip = (transition: Scene["transition"], localFrame: number) => {
  const progress = interpolate(localFrame, [0, 22], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (transition === "iris") {
    return `circle(${progress}% at 50% 50%)`;
  }

  if (transition === "wipe") {
    return `inset(0 ${100 - progress}% 0 0)`;
  }

  return undefined;
};

const motionTransform = (motion: Scene["motion"], localFrame: number) => {
  const rise = interpolate(localFrame, [0, 24], [38, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slide = interpolate(localFrame, [0, 24], [70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(localFrame, [0, 28], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = interpolate(localFrame, [0, 280], [-12, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (motion === "slide-left") {
    return `translateX(${slide}px)`;
  }

  if (motion === "zoom") {
    return `scale(${scale})`;
  }

  if (motion === "wipe") {
    return `translateY(${rise * 0.45}px) scale(${scale})`;
  }

  if (motion === "drift") {
    return `translate(${drift}px, ${rise * 0.25}px)`;
  }

  return `translateY(${rise}px)`;
};

const transitionFilter = (transition: Scene["transition"], localFrame: number) => {
  if (transition !== "blur") {
    return undefined;
  }

  const blur = interpolate(localFrame, [0, 24], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return `blur(${blur}px)`;
};

const cameraPower = {
  subtle: 1,
  medium: 1.65,
  strong: 2.35,
} satisfies Record<Scene["camera"]["intensity"], number>;

const cameraOrigin = {
  headline: "32% 44%",
  visual: "72% 52%",
  stat: "72% 56%",
  center: "50% 50%",
  left: "28% 50%",
  right: "72% 50%",
} satisfies Record<Scene["camera"]["focus"], string>;

const cameraTransform = (scene: Scene, localFrame: number) => {
  const power = cameraPower[scene.camera.intensity];
  const slow = interpolate(localFrame, [0, scene.durationSeconds * FPS], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pop = interpolate(localFrame, [0, 16, 36], [0, 1, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wobble = Math.sin(localFrame / 9) * power;

  if (scene.camera.move === "push-in") {
    return `scale(${1 + slow * 0.055 * power})`;
  }

  if (scene.camera.move === "pull-back") {
    return `scale(${1.08 + (1 - slow) * 0.035 * power})`;
  }

  if (scene.camera.move === "pan-left") {
    return `scale(${1 + 0.025 * power}) translateX(${slow * -34 * power}px)`;
  }

  if (scene.camera.move === "pan-right") {
    return `scale(${1 + 0.025 * power}) translateX(${slow * 34 * power}px)`;
  }

  if (scene.camera.move === "tilt-up") {
    return `scale(${1 + 0.018 * power}) translateY(${(1 - slow) * 30 * power}px)`;
  }

  if (scene.camera.move === "focus-pop") {
    return `scale(${1 + pop * 0.075 * power})`;
  }

  if (scene.camera.move === "orbit") {
    return `scale(${1 + 0.02 * power}) translate(${Math.sin(slow * Math.PI * 2) * 18 * power}px, ${Math.cos(slow * Math.PI * 2) * 12 * power}px) rotate(${Math.sin(slow * Math.PI * 2) * 0.8 * power}deg)`;
  }

  if (scene.camera.move === "handheld") {
    return `scale(${1 + 0.025 * power}) translate(${wobble}px, ${Math.cos(localFrame / 11) * power}px) rotate(${Math.sin(localFrame / 17) * 0.18 * power}deg)`;
  }

  return "none";
};

const Visual = ({scene, index}: {scene: Scene; index: number}) => {
  if (scene.visualType === "kinetic-text") {
    return <KineticWords scene={scene} />;
  }

  if (scene.visualType === "diagram") {
    return <Diagram scene={scene} />;
  }

  if (scene.visualType === "stat-wall") {
    return <StatWall scene={scene} />;
  }

  if (scene.visualType === "before-after") {
    return <BeforeAfter scene={scene} />;
  }

  if (scene.visualType === "myth-fact") {
    return <MythFact scene={scene} />;
  }

  if (scene.visualType === "image-collage") {
    return <ImageCollage scene={scene} />;
  }

  if (scene.visualType === "map") {
    return <MapLike scene={scene} />;
  }

  if (scene.visualType === "chart" || scene.visualType === "comparison") {
    return <Bars scene={scene} />;
  }

  if (scene.visualType === "timeline" || scene.visualType === "process") {
    return (
      <div className="steps">
        {["Frame", "Signal", "Action"].map((step, stepIndex) => (
          <div className="step" key={step}>
            <span>{String(stepIndex + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (scene.visualType === "quote") {
    return <div className="quoteMark">“</div>;
  }

  return (
    <div className="orbital">
      <div className="orbitalRing" />
      <div className="orbitalCore">{scene.stat ?? <SymbolMark scene={scene} />}</div>
      <div className="orbitalTag">Scene {index + 1}</div>
    </div>
  );
};

const SceneCard = ({
  scene,
  storyboard,
  index,
}: {
  scene: Scene;
  storyboard: Storyboard;
  index: number;
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - getSceneStartFrame(storyboard.scenes, index);
  const fade = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const push = scene.transition === "push" ? interpolate(localFrame, [0, 24], [42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) : 0;
  const rotate = scene.transition === "flip" ? interpolate(localFrame, [0, 24], [-8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) : 0;
  const cameraStyle = {
    transform: cameraTransform(scene, localFrame),
    transformOrigin: cameraOrigin[scene.camera.focus],
  } satisfies CSSProperties;

  return (
    <section
      className={`scene scene-${scene.visualType} layout-${scene.layout} template-${scene.template}`}
      style={{
        opacity: fade,
        transform: `${motionTransform(scene.motion, localFrame)} translateX(${push}px) rotateY(${rotate}deg)`,
        clipPath: transitionClip(scene.transition, localFrame),
        filter: transitionFilter(scene.transition, localFrame),
      }}
    >
      <div className="cameraLayer" style={cameraStyle}>
        <ShapeBackdrop scene={scene} />
        <div className="sceneMeta">
          <span>{scene.eyebrow}</span>
          <span>{sceneIcons[scene.visualType]}</span>
        </div>
        <div className="sceneGrid">
          <div className="copy">
            <h1>{scene.headline}</h1>
            <p>{scene.body}</p>
          </div>
          <Visual scene={scene} index={index} />
        </div>
      </div>
    </section>
  );
};

export const InfographicMinute = (storyboard: Storyboard) => {
  return (
    <main
      className="video"
      style={
        {
          "--bg": storyboard.palette.background,
          "--fg": storyboard.palette.foreground,
          "--accent": storyboard.palette.accent,
          "--secondary": storyboard.palette.secondary,
          "--art": storyboard.artDirection,
        } as CSSProperties
      }
      data-art={storyboard.artDirection}
      data-font={storyboard.fontPair}
      data-texture={storyboard.texture}
    >
      <div className="grain" />
      <div className="titleRail">
        <span>{storyboard.title}</span>
        <span>{storyboard.audience}</span>
      </div>
      {storyboard.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={getSceneStartFrame(storyboard.scenes, index)}
          durationInFrames={scene.durationSeconds * FPS}
        >
          <SceneCard scene={scene} storyboard={storyboard} index={index} />
        </Sequence>
      ))}
      <Audio src={staticFile("output/music/placeholder.wav")} volume={0.18} loop />
    </main>
  );
};
