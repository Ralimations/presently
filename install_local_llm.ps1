param(
  [string]$Model = "qwen3:0.6b",
  [switch]$InstallOllama
)

$ErrorActionPreference = "Stop"

Write-Host "Presently local LLM setup"
Write-Host "Model: $Model"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  if (-not $InstallOllama) {
    Write-Host ""
    Write-Host "Ollama is not installed or not on PATH."
    Write-Host "Install it from https://ollama.com/download or rerun:"
    Write-Host ".\install_local_llm.ps1 -InstallOllama"
    exit 1
  }

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "winget is not available. Install Ollama from https://ollama.com/download"
    exit 1
  }

  winget install --id Ollama.Ollama --source winget
}

Write-Host ""
Write-Host "Pulling $Model. This can take a few minutes."
ollama pull $Model

Write-Host ""
Write-Host "Local LLM is ready."
Write-Host "In Presently Settings, set:"
Write-Host "Provider: Ollama local"
Write-Host "Model: $Model"
Write-Host "API URL: http://localhost:11434"
