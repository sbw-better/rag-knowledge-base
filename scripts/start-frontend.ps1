param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"
Set-Location $frontendRoot
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot "logs") | Out-Null

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..."
    npm install
}

$listeners = netstat -ano | Select-String ":$Port " | Sort-Object -Unique
$stoppedPids = @{}
foreach ($line in $listeners) {
    if ($line -match "LISTENING\s+(\d+)$") {
        $pidToStop = [int]$Matches[1]
        if (-not $stoppedPids.ContainsKey($pidToStop)) {
            Write-Host "Stopping existing frontend process on port $Port, PID $pidToStop..."
            Stop-Process -Id $pidToStop -Force
            $stoppedPids[$pidToStop] = $true
        }
    }
}

$npmCmd = (where.exe npm.cmd | Select-Object -First 1)
if (-not $npmCmd) {
    throw "npm.cmd not found. Please install Node.js and ensure npm.cmd is in PATH."
}

$nodeExe = (where.exe node.exe | Select-Object -First 1)
if (-not $nodeExe) {
    throw "node.exe not found. Please install Node.js and ensure node.exe is in PATH."
}

Write-Host "Building frontend..."
& $npmCmd run build
if ($LASTEXITCODE -ne 0) {
    throw "frontend build failed"
}

$outLog = Join-Path $projectRoot "logs\frontend.out.log"
$errLog = Join-Path $projectRoot "logs\frontend.err.log"
$serverScript = Join-Path $projectRoot "scripts\serve-frontend.mjs"
$distRoot = Join-Path $frontendRoot "dist"

Write-Host "Starting frontend server on http://localhost:$Port ..."
Write-Host "This process keeps running. Press Ctrl+C to stop it."
Write-Host "Logs are also written to $outLog and $errLog"

& $nodeExe $serverScript --root $distRoot --port $Port --api http://localhost:8080 2> $errLog
