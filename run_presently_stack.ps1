param(
  [string]$OllamaModel = "qwen2.5:7b",
  [int]$SitePort = 5173,
  [int]$ApiPort = 8787,
  [int]$ModelServerPort = 8001,
  [switch]$SkipOllama,
  [switch]$SkipModelServer,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Test-HttpOk {
  param([string]$Url, [int]$TimeoutSeconds = 3)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Test-PortListening {
  param([int]$Port)

  $rows = netstat -ano | Select-String -Pattern ":$Port\s"
  return [bool]$rows
}

function Start-PowerShellWindow {
  param([string]$Title, [string]$Command)

  $escapedTitle = $Title.Replace("'", "''")
  $windowCommand = "`$Host.UI.RawUI.WindowTitle = '$escapedTitle'; $Command"
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($windowCommand))
  Start-Process powershell.exe -WorkingDirectory $ProjectRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-EncodedCommand",
    $encodedCommand
  )
}

function Ensure-Directories {
  New-Item -ItemType Directory -Force -Path `
    "output/storyboards", `
    "output/site", `
    "public/output/music", `
    "public/output/speech", `
    "public/output/videos", `
    "public/output/stills" | Out-Null
}

Write-Host ""
Write-Host "== Presently Stack Launcher =="
Write-Host "Project: $ProjectRoot"
Write-Host ""

Ensure-Directories

if (-not $SkipInstall -and -not (Test-Path "node_modules")) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "node_modules is missing and npm was not found. Install Node.js/npm, reopen PowerShell, then rerun this script."
  }

  Write-Host "Installing Node dependencies..."
  npm install
}

$env:PRESENTLY_PORT = [string]$SitePort
$env:PRESENTLY_API_PORT = [string]$ApiPort
$env:PRESENTLY_MODEL_SERVER_PORT = [string]$ModelServerPort
$env:PRESENTLY_OLLAMA_MODEL = $OllamaModel
$env:PRESENTLY_OLLAMA_URL = "http://localhost:11434"

if (-not $SkipOllama) {
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    if (Test-HttpOk "http://localhost:11434/api/tags") {
      Write-Host "Ollama server: already running"
    } else {
      Write-Host "Starting Ollama server..."
      Start-PowerShellWindow "Presently - Ollama" "ollama serve"
      Start-Sleep -Seconds 4
    }

    if (Test-HttpOk "http://localhost:11434/api/tags") {
      try {
        $tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
        $models = @($tags.models | ForEach-Object { $_.name })
        $hasModel = $models | Where-Object { $_ -eq $OllamaModel -or $_ -like "${OllamaModel}:*" }
        if ($hasModel) {
          Write-Host "Ollama model: $OllamaModel available"
        } else {
          Write-Host "Ollama model not found: $OllamaModel"
          Write-Host "Pull it in another terminal with: ollama pull $OllamaModel"
        }
      } catch {
        Write-Host "Ollama is running, but model list could not be read."
      }
    } else {
      Write-Host "Ollama server did not respond yet. Presently can still start."
    }
  } else {
    Write-Host "Ollama not found on PATH. Install Ollama or run with -SkipOllama."
  }
}

if (-not $SkipModelServer) {
  $venvPython = Join-Path $ProjectRoot "models\.venv\Scripts\python.exe"
  $modelServer = Join-Path $ProjectRoot "models\model_server.py"

  if (Test-HttpOk "http://localhost:$ModelServerPort/status") {
    Write-Host "Model server: already running at http://localhost:$ModelServerPort"
  } elseif ((Test-Path $venvPython) -and (Test-Path $modelServer)) {
    Write-Host "Starting model server..."
    Start-PowerShellWindow "Presently - Model Server" "`$env:PRESENTLY_MODEL_SERVER_PORT='$ModelServerPort'; .\run_model_server.ps1"
    Start-Sleep -Seconds 5
  } else {
    Write-Host "Model server not started. Run .\install_open_source_ai_models.ps1 first, or rerun with -SkipModelServer."
  }
}

if (Test-HttpOk "http://localhost:$SitePort") {
  Write-Host "Presently site: already running at http://localhost:$SitePort"
} elseif ((Test-PortListening $SitePort) -or (Test-PortListening $ApiPort)) {
  Write-Host "A process is already using site/API ports $SitePort/$ApiPort."
  Write-Host "Open http://localhost:$SitePort or stop the existing process before restarting."
} else {
  Write-Host "Starting Presently web app..."
  Start-PowerShellWindow "Presently - Web App" "`$env:PRESENTLY_PORT='$SitePort'; `$env:PRESENTLY_API_PORT='$ApiPort'; `$env:PRESENTLY_MODEL_SERVER_PORT='$ModelServerPort'; npm run dev"
  Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "== URLs =="
Write-Host "Presently:    http://localhost:$SitePort"
Write-Host "API:          http://localhost:$ApiPort/api/jobs"
Write-Host "Model server: http://localhost:$ModelServerPort/status"
Write-Host "Ollama:       http://localhost:11434/api/tags"
Write-Host ""
Write-Host "Tip: If the model server badge is red, keep using Local synth/music fallback or run:"
Write-Host "  .\install_open_source_ai_models.ps1 -Torch cpu"
Write-Host "  .\run_model_server.ps1"
Write-Host ""
