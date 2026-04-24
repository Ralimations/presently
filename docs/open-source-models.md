# Open-Source AI Model Setup

Use this carefully. The current local profile targets an RTX 2060 6GB / 32GB RAM Windows machine, so the app defaults to CPU-safe storyboard generation and procedural music.

## Recommended Machine

- NVIDIA GPU with 8GB+ VRAM for small image workflows.
- 12GB-24GB+ VRAM for smoother music/image generation.
- 32GB system RAM recommended.
- 50GB+ free disk space minimum.
- RTX 2060 6GB: use Embedded Gemma 2B, local synth music, draft render scale, and low render concurrency.

## Install

```powershell
.\install_open_source_ai_models.ps1 -Torch cpu
```

CUDA, only after updating the NVIDIA driver:

```powershell
.\install_open_source_ai_models.ps1 -Torch cuda
```

Skip large categories if needed:

```powershell
.\install_open_source_ai_models.ps1 -SkipLlm -SkipSpeech
```

## What It Installs

- PyTorch.
- Hugging Face tooling: `transformers`, `diffusers`, `accelerate`, `huggingface-hub`, `safetensors`.
- Music tooling: the CPU-safe profile installs the ACE-Step repo without heavy CUDA dependencies; the CUDA profile installs AudioCraft/MusicGen and ACE-Step requirements.
- Image tooling for diffusion-based visual generation.
- Speech tooling for Whisper/faster-whisper.
- Optional local LLM tooling via `llama-cpp-python`.

## Notes

- ACE-Step is a 3.5B music model and is disabled by default for the RTX 2060 profile. Set `PRESENTLY_ENABLE_ACE_STEP=1` only after installing checkpoints and fixing CUDA.
- The current screenshot shows PyTorch reporting an old NVIDIA driver. Until that is fixed, prefer `-Torch cpu`.
- Some models require manual Hugging Face login or license acceptance before weights download.
- MusicGen model weights may have non-commercial constraints. Verify licenses before commercial use.
- ACE-Step and other model repos may change their install requirements over time.
