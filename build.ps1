# Better Canvas -- build loadable extension folders for each browser.
# Output: dist/chrome and dist/firefox (each has manifest.json + src + icons).
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Check-Syntax {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Write-Host "node not found; skipping syntax check." -ForegroundColor Yellow; return }
    Write-Host "Syntax-checking JavaScript files..."
    $files = Get-ChildItem -Path (Join-Path $root "src") -Recurse -Filter *.js
    $failed = 0
    foreach ($f in $files) {
        & node --check $f.FullName 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  FAIL $($f.FullName)" -ForegroundColor Red
            & node --check $f.FullName
            $failed++
        }
    }
    if ($failed -gt 0) { throw "$failed file(s) failed syntax check." }
    Write-Host "  OK $($files.Count) files" -ForegroundColor Green
}

function Build-Target($name, $manifestSource) {
    $out = Join-Path $root "dist\$name"
    if (Test-Path $out) { Remove-Item $out -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    Copy-Item (Join-Path $root "src")   (Join-Path $out "src")   -Recurse
    Copy-Item (Join-Path $root "icons") (Join-Path $out "icons") -Recurse
    Copy-Item (Join-Path $root $manifestSource) (Join-Path $out "manifest.json") -Force
    Write-Host "Built $name -> $out" -ForegroundColor Cyan
}

function Run-Tests {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Write-Host "node not found; skipping tests." -ForegroundColor Yellow; return }
    Write-Host "Running test suite..."
    & node (Join-Path $root "test\run.js")
    if ($LASTEXITCODE -ne 0) { throw "Test suite failed; not building." }
}

Check-Syntax
Run-Tests
Build-Target "chrome"  "manifest.json"
Build-Target "firefox" "manifest.firefox.json"

Write-Host ""
Write-Host "Chrome:  chrome://extensions -> Load unpacked -> dist\chrome"
Write-Host "Firefox: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> dist\firefox\manifest.json"
