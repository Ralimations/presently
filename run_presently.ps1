$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$NpmCommand = Get-Command "npm" -ErrorAction SilentlyContinue
$FallbackNode = Join-Path $env:USERPROFILE ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"

function Ensure-Directories {
  New-Item -ItemType Directory -Force -Path `
    "output/storyboards", `
    "output/site", `
    "public/output/music", `
    "public/output/videos", `
    "public/output/stills" | Out-Null
}

Ensure-Directories

if (-not (Test-Path "node_modules")) {
  if (-not $NpmCommand) {
    throw "node_modules is missing and npm was not found. Install Node.js/npm, reopen PowerShell, then run this again."
  }

  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Starting Presently web app..."

if ($NpmCommand) {
  npm run dev
  exit $LASTEXITCODE
}

if (-not (Test-Path $FallbackNode)) {
  throw "npm was not found. Install Node.js from https://nodejs.org, then reopen PowerShell."
}

& $FallbackNode "server/dev-server.mjs"
