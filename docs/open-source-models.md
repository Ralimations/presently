# Open-Source AI Model Setup

Use this only on a stronger laptop or desktop. It installs heavy Python model tooling into `models/.venv` and keeps downloaded repos/models outside the app source.

## Recommended Machine

- NVIDIA GPU with 8GB+ VRAM for small workflows.
- 12GB-24GB+ VRAM for smoother music/image generation.
- 32GB system RAM recommended.
- 50GB+ free disk space minimum.

## Install

```powershell
.\install_open_source_ai_models.ps1 -Torch cuda
```

CPU-only:

```powershell
.\install_open_source_ai_models.ps1 -Torch cpu
```

Skip large categories if needed:

```powershell
.\install_open_source_ai_models.ps1 -SkipLlm -SkipSpeech
```

## What It Installs

- PyTorch.
- Hugging Face tooling: `transformers`, `diffusers`, `accelerate`, `huggingface-hub`, `safetensors`.
- Music tooling: AudioCraft/MusicGen and ACE-Step repo.
- Image tooling for diffusion-based visual generation.
- Speech tooling for Whisper/faster-whisper.
- Optional local LLM tooling via `llama-cpp-python`.

## Notes

- This prepares the stronger laptop; the web app still needs provider code to call these models.
- Some models require manual Hugging Face login or license acceptance before weights download.
- MusicGen model weights may have non-commercial constraints. Verify licenses before commercial use.
- ACE-Step and other model repos may change their install requirements over time.
