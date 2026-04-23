# Presently

Prompt-driven MVP for one-minute infographic videos. The user enters one prompt; the app automatically creates a validated storyboard, page layouts, transitions, a music prompt, and a Remotion render plan.

## Run

```bash
npm install
npm run dev
```

On Windows, use the launcher:

```powershell
.\run_presently.ps1
```

## Render

```bash
npm run music:placeholder
npm run storyboard -- --topic="The future of urban farming" --audience="city planners" --tone=clear --aspect=16:9
npm run render:storyboard
```

The web app handles storyboard saving, music generation, still rendering, and MP4 rendering from the Renders tab.

Generated files stay inside the project under:

- `output/storyboards/storyboard.json`
- `public/output/videos/infographic.mp4`
- `public/output/stills/frame.png`
- `output/site`
- `public/output/music/placeholder.wav`

## Architecture

- `src/storyboard/schema.ts` is the safety boundary for LLM output.
- `src/storyboard/generateStoryboard.ts` simulates the LLM reprompting flow and can be replaced by an LLM call returning the same schema.
- `src/remotion/index.ts` is the Remotion entrypoint registered through `registerRoot()`.
- `src/remotion/Root.tsx` defines the Remotion composition and dynamic metadata.
- `src/remotion/InfographicMinute.tsx` is the trusted React/Remotion renderer.
- `src/music/providers.ts` defines the provider seam for ACE-Step or MusicGen integration.
- `scripts/create-placeholder-music.ts` creates a local 60-second WAV so Remotion renders include music before model integration.

## Generation Flow

1. User enters a prompt.
2. The prompt is refined into `refinedPrompt.sitePrompt`, `refinedPrompt.musicPrompt`, and `refinedPrompt.renderBrief`.
3. The music prompt is sent to the music provider seam.
4. The site prompt becomes a structured Remotion storyboard with scene pages, layout variants, transitions, motion presets, copy, and chart data.
5. Remotion combines the trusted scene plan and generated music asset into the final video.

Users do not need to edit individual pages. Settings are only for high-level defaults such as audience, tone, aspect ratio, refined prompts, and output paths.

## Remotion Integration

- `remotion.config.ts` sets the Remotion entrypoint and public asset folder.
- `npm run remotion` opens Remotion Studio using the configured entrypoint.
- `npm run render:storyboard` renders the `InfographicMinute` composition with `output/storyboards/storyboard.json`.
- Remotion packages are pinned to the same exact version to avoid package mismatch issues.

## Asset Packs

The renderer has built-in font-pair, symbol, texture, transition, and template variants. To download larger external packs for future integration, run:

```bash
npm run assets:install
```

This installs icon libraries, Remotion visual packages, and local font packages while keeping the user workflow prompt-only.

## Open-Source AI Models

Heavy local models should be installed on a stronger machine:

```powershell
.\install_open_source_ai_models.ps1 -Torch cuda
```

See `docs/open-source-models.md` for GPU/CPU options and model notes.

## Production Notes

- Keep LLM output constrained to storyboard JSON. Do not execute generated React.
- Validate exact 60-second timing before rendering.
- Verify Remotion licensing and music model licensing before commercial launch.
- Add retrieval/citations before positioning factual explainers as authoritative.
