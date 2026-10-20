# Stops everything start-all.ps1 started. The local database keeps its data.
# Usage:  powershell -ExecutionPolicy Bypass -File .\stop-all.ps1

foreach ($port in 8000, 3000, 8081) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match "app\.worker" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "AgriSmart*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

$python = Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe"
$pgData = Join-Path $env:USERPROFILE "agrismart-pgdata"
$pgCtl = & $python -c "import pgserver, pathlib; print(pathlib.Path(pgserver.__file__).parent / 'pginstall' / 'bin' / 'pg_ctl.exe')" 2>$null
if ($pgCtl -and (Test-Path $pgCtl) -and (Test-Path (Join-Path $pgData "postmaster.pid"))) {
    & $pgCtl -D $pgData stop -m fast | Out-Null
}
Write-Host "AgriSmart stopped."
