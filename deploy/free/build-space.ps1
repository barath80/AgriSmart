# Assembles ./space, a folder you push to a Hugging Face Docker Space (see README.md).
#   powershell -ExecutionPolicy Bypass -File .\build-space.ps1
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = Resolve-Path (Join-Path $here "..\..")
$out = Join-Path $here "space"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory $out | Out-Null

$backend = Join-Path $out "backend"
New-Item -ItemType Directory $backend | Out-Null
foreach ($item in "app", "migrations", "seeds", "pyproject.toml", "alembic.ini") {
    Copy-Item (Join-Path $root "backend\$item") (Join-Path $backend $item) -Recurse -Force
}
Get-ChildItem $backend -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Only the newest version of each model, and only the file the runtime loads.
$models = Join-Path $out "models"
foreach ($name in "crop", "yield", "disease", "pest", "subject") {
    $base = Join-Path $root "ml\artifacts\$name"
    if (-not (Test-Path $base)) { Write-Warning "no $name model found; skipping"; continue }
    $latest = Get-ChildItem $base -Directory | Sort-Object { [int]($_.Name -replace '.*_v', '') } | Select-Object -Last 1
    $dest = Join-Path $models "$name\$($latest.Name)"
    New-Item -ItemType Directory $dest -Force | Out-Null
    $meta = Get-Content (Join-Path $latest.FullName "metadata.json") -Raw | ConvertFrom-Json
    Copy-Item (Join-Path $latest.FullName "metadata.json") $dest
    Copy-Item (Join-Path $latest.FullName $meta.artifact) $dest
    Get-ChildItem $latest.FullName -File | Where-Object { $_.Name -notin @("metadata.json", $meta.artifact) -and $_.Extension -in ".json", ".csv" -and $_.Length -lt 5MB } | Copy-Item -Destination $dest
}

# The farmer web app (expo export), served by the API at "/".
$web = Join-Path $here "web-dist"
if (Test-Path $web) { Copy-Item $web (Join-Path $out "web") -Recurse } else { Write-Warning "no web-dist; the Space will serve the API only" }

Copy-Item (Join-Path $here "Dockerfile") $out
Copy-Item (Join-Path $here "start.sh") $out
# Shell scripts must keep LF line endings to run in the Linux container.
(Get-Content (Join-Path $out "start.sh") -Raw) -replace "`r`n", "`n" | Set-Content (Join-Path $out "start.sh") -NoNewline

$emoji = [char]::ConvertFromUtf32(0x1F33E)
$readme = "---`ntitle: AgriSmart`nemoji: $emoji`ncolorFrom: green`ncolorTo: yellow`nsdk: docker`napp_port: 7860`npinned: false`n---`nAgriSmart API, worker and farmer web app. See the project repository for details.`n"
[System.IO.File]::WriteAllText((Join-Path $out "README.md"), $readme, (New-Object System.Text.UTF8Encoding($false)))

# Large model files go through Git LFS/Xet on Hugging Face.
"*.sh text eol=lf`nmodels/**/*.onnx filter=lfs diff=lfs merge=lfs -text`nmodels/**/model*.json filter=lfs diff=lfs merge=lfs -text`nweb/**/*.ttf filter=lfs diff=lfs merge=lfs -text`nweb/**/*.png filter=lfs diff=lfs merge=lfs -text`nweb/**/*.jpg filter=lfs diff=lfs merge=lfs -text`nweb/**/*.ico filter=lfs diff=lfs merge=lfs -text`nweb/**/*.otf filter=lfs diff=lfs merge=lfs -text`nweb/**/*.woff filter=lfs diff=lfs merge=lfs -text`nweb/**/*.woff2 filter=lfs diff=lfs merge=lfs -text" | Set-Content (Join-Path $out ".gitattributes") -Encoding ascii
"{0:N0} MB ready in {1}" -f ((Get-ChildItem $out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), $out
