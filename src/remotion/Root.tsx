import {Composition} from "remotion";
import type {CalculateMetadataFunction} from "remotion";
import {defaultStoryboard} from "../storyboard/defaultStoryboard";
import {
  FPS,
  TARGET_DURATION_FRAMES,
  getDimensions,
  storyboardSchema,
  validateStoryboard,
  type Storyboard,
} from "../storyboard/schema";
import {InfographicMinute} from "./InfographicMinute";

const calculateMetadata: CalculateMetadataFunction<Storyboard> = ({props}) => {
  const storyboard = validateStoryboard(props);
  const dimensions = getDimensions(storyboard.aspectRatio);

  return {
    props: storyboard,
    width: dimensions.width,
    height: dimensions.height,
    durationInFrames: TARGET_DURATION_FRAMES,
    fps: FPS,
  };
};

export const RemotionRoot = () => {
  const dimensions = getDimensions(defaultStoryboard.aspectRatio);

  return (
    <Composition
      id="InfographicMinute"
      component={InfographicMinute}
      durationInFrames={TARGET_DURATION_FRAMES}
      fps={FPS}
      width={dimensions.width}
      height={dimensions.height}
      schema={storyboardSchema}
      calculateMetadata={calculateMetadata}
      defaultProps={defaultStoryboard}
    />
  );
};
