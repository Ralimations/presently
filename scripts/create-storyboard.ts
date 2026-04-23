import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {generateStoryboard} from "../src/storyboard/generateStoryboard";
import {AspectRatio, Tone} from "../src/storyboard/schema";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const outputPath = args.get("out") ?? "output/storyboards/storyboard.json";
const storyboard = generateStoryboard({
  topic: args.get("topic") ?? "AI-generated one-minute explainers",
  audience: args.get("audience") ?? "founders and content teams",
  tone: (args.get("tone") ?? "bold") as Tone,
  aspectRatio: (args.get("aspect") ?? "16:9") as AspectRatio,
  sources: args.get("sources") ?? "",
});

mkdirSync(dirname(outputPath), {recursive: true});
writeFileSync(outputPath, `${JSON.stringify(storyboard, null, 2)}\n`);
console.log(`Wrote validated storyboard to ${outputPath}`);
