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
    & $PythonPath -m pip install audiocraft

    $AceStepPath = Join-Path $ModelsPath "ACE-Step"
    if (-not (Test-Path $AceStepPath)) {
      git clone https://github.com/ace-step/ACE-Step.git $AceStepPath
    }

    & $PythonPath -m pip install -r (Join-Path $AceStepPath "requirements.txt")
  }
}

if (-not $SkipImages) {
  Invoke-Step "Install image generation tooling" {
    & $PythonPath -m pip install compel invisible-watermark opencv-python
  }
}

if (-not $SkipSpeech) {
  Invoke-Step "Install speech tooling" {
    & $PythonPath -m pip install openai-whisper faster-whisper
  }
}

if (-not $SkipLlm) {
  Invoke-Step "Install local LLM tooling" {
    & $PythonPath -m pip install llama-cpp-python
  }
}

Invoke-Step "Write environment file" {
  $envFile = Join-Path $ProjectRoot ".env.local"
  @(
    "PRESENTLY_MODELS_DIR=$ModelsPath",
    "PRESENTLY_PYTHON=$PythonPath",
    "PRESENTLY_MUSIC_PROVIDER=placeholder",
    "PRESENTLY_IMAGE_PROVIDER=local",
    "PRESENTLY_LLM_PROVIDER=local"
  ) | Set-Content -Path $envFile -Encoding UTF8

  Write-Host "Wrote $envFile"
}

Write-Host ""
Write-Host "Open-source model tooling installed."
Write-Host "Activate with: $VenvPath\Scripts\Activate.ps1"
Write-Host "Models folder: $ModelsPath"
