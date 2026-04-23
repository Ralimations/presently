import {Config} from "@remotion/cli/config";
import {existsSync} from "node:fs";

const chromeExecutable = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

Config.setEntryPoint("./src/remotion/index.ts");
Config.setPublicDir("./public");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

if (existsSync(chromeExecutable)) {
  Config.setBrowserExecutable(chromeExecutable);
}
