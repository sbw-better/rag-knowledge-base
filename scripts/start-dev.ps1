param(
    [string]$JavaHome = "D:\tools\Java\jdk-17.0.19",
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

New-Item -ItemType Directory -Force -Path "logs" | Out-Null

Write-Host "Starting infrastructure containers..."
docker compose up -d mysql minio milvus
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed"
}

$listeners = netstat -ano | Select-String ":$Port " | Sort-Object -Unique
$stoppedPids = @{}
foreach ($line in $listeners) {
    if ($line -match "LISTENING\s+(\d+)$") {
        $pidToStop = [int]$Matches[1]
        if (-not $stoppedPids.ContainsKey($pidToStop)) {
            Write-Host "Stopping existing process on port $Port, PID $pidToStop..."
            Stop-Process -Id $pidToStop -Force
            $stoppedPids[$pidToStop] = $true
        }
    }
}

Write-Host "Building application jar with JDK 17..."
$env:JAVA_HOME = $JavaHome
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
mvn -DskipTests package
if ($LASTEXITCODE -ne 0) {
    throw "mvn package failed"
}

Write-Host "Starting Spring Boot application..."
$javaExe = Join-Path $JavaHome "bin\java.exe"
$outLog = Join-Path $projectRoot "logs\app.out.log"
$errLog = Join-Path $projectRoot "logs\app.err.log"
cmd /c "start `"ragkb-app`" /D `"$projectRoot`" /B `"$javaExe`" -jar `"target\rag-knowledge-base-0.1.0-SNAPSHOT.jar`" > `"$outLog`" 2> `"$errLog`""

Write-Host "Waiting for health endpoint..."
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$Port/actuator/health" -TimeoutSec 3
        if ($health.status -eq "UP") {
            Write-Host "Application is UP: http://localhost:$Port/swagger-ui.html"
            exit 0
        }
    } catch {
    }
}

Write-Host "Application did not become healthy. Check logs/app.out.log and logs/app.err.log"
exit 1
