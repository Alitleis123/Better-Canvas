# Better Canvas — build loadable extension folders for each browser.
# Output: dist/chrome and dist/firefox (each has manifest.json + src + icons).
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Build-Target($name, $manifestSource) {
    $out = Join-Path $root "dist\$name"
    if (Test-Path $out) { Remove-Item $out -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    Copy-Item (Join-Path $root "src")   (Join-Path $out "src")   -Recurse
    Copy-Item (Join-Path $root "icons") (Join-Path $out "icons") -Recurse
    Copy-Item (Join-Path $root $manifestSource) (Join-Path $out "manifest.json") -Force
    Write-Host "Built $name -> $out"
}

Build-Target "chrome"  "manifest.json"
Build-Target "firefox" "manifest.firefox.json"

Write-Host ""
Write-Host "Chrome:  chrome://extensions -> Load unpacked -> dist\chrome"
Write-Host "Firefox/Zen: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> dist\firefox\manifest.json"
