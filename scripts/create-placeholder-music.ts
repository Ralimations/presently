import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";

const outputPath = "public/output/music/placeholder.wav";
const sampleRate = 44100;
const durationSeconds = 60;
const channels = 1;
const bitsPerSample = 16;
const totalSamples = sampleRate * durationSeconds;
const dataSize = totalSamples * channels * (bitsPerSample / 8);
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

for (let sample = 0; sample < totalSamples; sample += 1) {
  const seconds = sample / sampleRate;
  const pulse = Math.sin(2 * Math.PI * 110 * seconds) * 0.18;
  const shimmer = Math.sin(2 * Math.PI * 220 * seconds) * 0.08;
  const tick = Math.sin(2 * Math.PI * 880 * seconds) * (sample % sampleRate < 1200 ? 0.1 : 0);
  const fadeIn = Math.min(1, seconds / 2);
  const fadeOut = Math.min(1, (durationSeconds - seconds) / 3);
  const amplitude = Math.max(-1, Math.min(1, (pulse + shimmer + tick) * fadeIn * fadeOut));
  buffer.writeInt16LE(Math.round(amplitude * 32767), 44 + sample * 2);
}

mkdirSync(dirname(outputPath), {recursive: true});
writeFileSync(outputPath, buffer);
console.log(`Wrote ${durationSeconds}s placeholder music to ${outputPath}`);
