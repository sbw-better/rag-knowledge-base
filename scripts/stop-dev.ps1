$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$listeners = netstat -ano | Select-String ":8080 "
foreach ($line in $listeners) {
    if ($line -match "LISTENING\s+(\d+)$") {
        $pidToStop = [int]$Matches[1]
        Write-Host "Stopping application process on port 8080, PID $pidToStop..."
        Stop-Process -Id $pidToStop -Force
    }
}

Write-Host "Stopping infrastructure containers..."
docker compose stop postgres minio
