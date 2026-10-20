# Starts the whole AgriSmart stack for local development, each service in its own window:
# database, API, worker, admin dashboard and the mobile app (Expo Go QR code + web).
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Stop:   powershell -ExecutionPolicy Bypass -File .\stop-all.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$python = Join-Path $backend ".venv\Scripts\python.exe"
$pgData = Join-Path $env:USERPROFILE "agrismart-pgdata"

if (-not (Test-Path $python)) { throw "backend\.venv is missing. Run the setup in README.md first." }

# Phones reach this PC through its Wi-Fi/LAN address, not 127.0.0.1.
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress
if (-not $lanIp) { $lanIp = "127.0.0.1" }
$apiUrl = "http://${lanIp}:8000"

# Free the ports in case an earlier run is still alive.
foreach ($port in 8000, 3000, 8081) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# 1. Database. Skipped when DATABASE_URL points somewhere else (for example Supabase).
$dbUrl = (Get-Content (Join-Path $backend ".env") | Where-Object { $_ -like "DATABASE_URL=*" }) -replace "^DATABASE_URL=", ""
if ($dbUrl -match "127\.0\.0\.1|localhost") {
    # pgserver's bundled PostgreSQL, started on the fixed port that DATABASE_URL names
    # (pgserver itself would pick a random port on every start).
    $dbPort = if ($dbUrl -match ":(\d+)/") { $Matches[1] } else { "5432" }
    $pgBin = & $python -c "import pgserver, pathlib; print(pathlib.Path(pgserver.__file__).parent / 'pginstall' / 'bin')"
    if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
        Write-Host "Creating the local database cluster in $pgData ..."
        & (Join-Path $pgBin "initdb.exe") -D $pgData -U postgres --auth=trust -E UTF8 | Out-Null
    }
    $listening = Get-NetTCPConnection -LocalPort $dbPort -State Listen -ErrorAction SilentlyContinue
    if (-not $listening) {
        Write-Host "Starting local PostgreSQL on port $dbPort..."
        Remove-Item (Join-Path $pgData "postmaster.pid") -ErrorAction SilentlyContinue  # stale after a crash
        # Launched detached: the server would otherwise inherit this window's output and keep
        # the script waiting. Only pg_ctl itself is waited for.
        $pgCtl = Start-Process (Join-Path $pgBin "pg_ctl.exe") -PassThru -WindowStyle Hidden -ArgumentList @(
            "-D", "`"$pgData`"", "-o", "`"-p $dbPort -h 127.0.0.1`"", "-l", "`"$pgData\server.log`"", "-w", "start")
        $pgCtl.WaitForExit()
        if (-not (Get-NetTCPConnection -LocalPort $dbPort -State Listen -ErrorAction SilentlyContinue)) {
            throw "Local PostgreSQL did not start; see $pgData\server.log"
        }
    }
    $dbName = if ($dbUrl -match "/([^/?]+)(\?|$)") { $Matches[1] } else { "agrismart" }
    & $python -c "import asyncio, asyncpg`nasync def m():`n    c = await asyncpg.connect('postgresql://postgres@127.0.0.1:$dbPort/postgres')`n    if not await c.fetchval('select 1 from pg_database where datname=`$1', '$dbName'):`n        await c.execute('create database $dbName')`n    await c.close()`nasyncio.run(m())"
    Push-Location $backend
    & .venv\Scripts\alembic.exe upgrade head
    Pop-Location
} else {
    Write-Host "Using the external database from backend\.env (local PostgreSQL not started)."
}

function Start-Service($title, $directory, $command) {
    $script = "`$host.UI.RawUI.WindowTitle = '$title'; $command"
    Start-Process powershell -WorkingDirectory $directory -ArgumentList "-NoExit", "-Command", $script | Out-Null
}

# 2-5. Services.
Start-Service "AgriSmart API" $backend ".venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Service "AgriSmart Worker" $backend ".venv\Scripts\python -m app.worker"
Start-Service "AgriSmart Admin" (Join-Path $root "admin") "`$env:AGRISMART_API_URL='http://127.0.0.1:8000'; if (-not (Test-Path .next)) { npm run build }; npx next start -p 3000"
Start-Service "AgriSmart Mobile (scan QR)" (Join-Path $root "mobile") "`$env:EXPO_PUBLIC_API_URL='$apiUrl'; npx expo start --lan --port 8081 --clear 2>&1 | Tee-Object -FilePath .expo-dev.log"

Write-Host "Waiting for the API..."
$ready = $false
foreach ($i in 1..40) {
    try { if ((Invoke-WebRequest "http://127.0.0.1:8000/ready" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $ready = $true; break } } catch {}
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) { Write-Host "AgriSmart is running." -ForegroundColor Green } else { Write-Host "The API is not ready yet; check the 'AgriSmart API' window." -ForegroundColor Yellow }
Write-Host "  Farmer app (phone): scan the QR code in the 'AgriSmart Mobile (scan QR)' window with Expo Go"
Write-Host "  Farmer app (web):   http://localhost:8081   (press w in the Mobile window if it does not open)"
Write-Host "  Admin dashboard:    http://localhost:3000"
Write-Host "  API docs:           http://127.0.0.1:8000/docs"
Write-Host "  Phone uses API at:  $apiUrl  (phone and PC must be on the same Wi-Fi)"
