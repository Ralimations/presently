export type MusicProviderName = "placeholder" | "ace-step" | "musicgen";

export type MusicGenerationRequest = {
  prompt: string;
  durationSeconds: number;
  outputPath: string;
};

export type MusicGenerationResult = {
  provider: MusicProviderName;
  outputPath: string;
  licenseNote: string;
};

export interface MusicProvider {
  name: MusicProviderName;
  generate(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
}

export const openSourceMusicProviderNotes: Record<
  Exclude<MusicProviderName, "placeholder">,
  string
> = {
  "ace-step":
    "Intended provider for commercial-friendly open-source music generation. Verify the exact model license and deployment requirements before launch.",
  musicgen:
    "Useful local text-to-music baseline through AudioCraft, but Meta's released weights have non-commercial licensing constraints.",
};
