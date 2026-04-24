param(
  [ValidateSet("cuda", "cpu")]
  [string]$Torch = "cuda",
  [switch]$SkipMusic,
  [switch]$SkipImages,
  [switch]$SkipSpeech,
  [switch]$SkipLlm,
  [string]$ModelsDir = "models"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Require-Command {
  param([string]$Name, [string]$InstallHint)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. $InstallHint"
  }
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "== $Name =="
  & $Action
}

Require-Command "git" "Install Git: https://git-scm.com/downloads"
Require-Command "python" "Install Python 3.11 or newer and enable Add to PATH."

$ModelsPath = Join-Path $ProjectRoot $ModelsDir
$VenvPath = Join-Path $ModelsPath ".venv"
$PythonPath = Join-Path $VenvPath "Scripts/python.exe"

New-Item -ItemType Directory -Force -Path $ModelsPath | Out-Null

Invoke-Step "Create Python virtual environment" {
  if (-not (Test-Path $PythonPath)) {
    python -m venv $VenvPath
  }

  & $PythonPath -m pip install --upgrade pip setuptools wheel
}

Invoke-Step "Install PyTorch" {
  if ($Torch -eq "cuda") {
    & $PythonPath -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
  } else {
    & $PythonPath -m pip install torch torchvision torchaudio
  }
}

Invoke-Step "Install shared model tooling" {
  & $PythonPath -m pip install `
    accelerate `
    diffusers `
    einops `
    imageio `
    imageio-ffmpeg `
    numpy `
    pillow `
    protobuf `
    scipy `
    sentencepiece `
    soundfile `
    transformers `
    huggingface-hub `
    safetensors
}

if (-not $SkipMusic) {
  Invoke-Step "Install music generation tooling" {
    if ($Torch -eq "cuda") {
      Write-Host "MusicGen/ACE-Step CUDA tooling is heavy for 6GB VRAM. Continuing because -Torch cuda was selected."
      & $PythonPath -m pip install audiocraft
    } else {
      Write-Host "Skipping heavy MusicGen CUDA package on the CPU/RTX 2060-safe profile."
    }

    $AceStepPath = Join-Path $ModelsPath "ACE-Step"
    if (-not (Test-Path $AceStepPath)) {
      git clone https://github.com/ace-step/ACE-Step.git $AceStepPath
    }

    if ($Torch -eq "cuda") {
      & $PythonPath -m pip install -r (Join-Path $AceStepPath "requirements.txt")
    } else {
      & $PythonPath -m pip install -e $AceStepPath --no-deps
    }
  }
}

if (-not $SkipImages) {
  Invoke-Step "Install image generation tooling" {
    & $PythonPath -m pip install compel invisible-watermark opencv-python
  }
}

if (-not $SkipSpeech) {
  Invoke-Step "Install Kokoro TTS (narration)" {
    # Kokoro-ONNX: Apache 2.0, CPU-friendly, ~165MB, natural voice
    & $PythonPath -m pip install kokoro-onnx soundfile
    Write-Host "Kokoro TTS installed. Voice models auto-download on first use."
  }

  Invoke-Step "Install model server dependencies" {
    $ModelReqs = Join-Path $ModelsPath "requirements-model-server.txt"
    if (Test-Path $ModelReqs) {
      & $PythonPath -m pip install -r $ModelReqs
    }
  }
}

if (-not $SkipLlm) {
  Invoke-Step "Install local LLM tooling (llama-cpp-python CPU wheel)" {
    & $PythonPath -m pip install llama-cpp-python==0.3.19 --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
  }
}

Invoke-Step "Write environment file" {
  $envFile = Join-Path $ProjectRoot ".env.local"
  @(
    "PRESENTLY_MODELS_DIR=$ModelsPath",
    "PRESENTLY_PYTHON=$PythonPath",
    "PRESENTLY_MUSIC_PROVIDER=musicgen",
    "PRESENTLY_MODEL_SERVER_PORT=8001",
    "PRESENTLY_IMAGE_PROVIDER=local",
    "PRESENTLY_LLM_PROVIDER=ollama",
    "PRESENTLY_OLLAMA_MODEL=qwen2.5:7b",
    "PRESENTLY_OLLAMA_URL=http://localhost:11434"
  ) | Set-Content -Path $envFile -Encoding UTF8

  Write-Host "Wrote $envFile"
}

Write-Host ""
Write-Host "Open-source model tooling installed."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Pull the LLM:       ollama pull qwen2.5:7b"
Write-Host "  2. Start model server: .\run_model_server.ps1"
Write-Host "  3. Start Presently:    .\run_presently.ps1"
Write-Host ""
Write-Host "Activate venv: $VenvPath\Scripts\Activate.ps1"
Write-Host "Models folder: $ModelsPath"
