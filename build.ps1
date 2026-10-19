# Better Canvas -- build loadable extension folders for each browser.
# Output: dist/chrome and dist/firefox (each has manifest.json + src + icons).
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Check-Syntax {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { Write-Host "node not found; skipping syntax check." -ForegroundColor Yellow; return }
    Write-Host "Syntax-checking JavaScript files..."
    $files = Get-ChildItem -Path (Join-Path $root "src") -Recurse -Filter *.js
    $failed = 0
    foreach ($f in $files) {
        & $node.Source --check $f.FullName 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  FAIL $($f.FullName)" -ForegroundColor Red
            & $node.Source --check $f.FullName
            $failed++
        }
    }
    if ($failed -gt 0) { throw "$failed file(s) failed syntax check." }
    Write-Host "  OK $($files.Count) files" -ForegroundColor Green
}

# Compress-Archive in Windows PowerShell stores paths as "src\x.js". Zip paths use
# "/": Firefox's add-on site rejects backslashes and macOS Archive Utility keeps
# them as part of the file name.
function Write-Zip($dir, $archive) {
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    $base = [System.IO.Path]::GetFullPath($dir).TrimEnd('\') + '\'
    $zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($f in Get-ChildItem -LiteralPath $dir -Recurse -File) {
            $entry = $f.FullName.Substring($base.Length).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $zip.Dispose() }
}

function Build-Target($name, $manifestSource) {
    $out = Join-Path $root "dist\$name"
    $resolvedOut = [System.IO.Path]::GetFullPath($out)
    $expectedParent = [System.IO.Path]::GetFullPath((Join-Path $root "dist"))
    if ([System.IO.Path]::GetDirectoryName($resolvedOut) -ne $expectedParent -or $name -notin @("chrome", "firefox")) {
        throw "Refusing to replace an output folder outside the project's dist directory."
    }
    if (Test-Path -LiteralPath $resolvedOut) { Remove-Item -LiteralPath $resolvedOut -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    Copy-Item (Join-Path $root "src")   (Join-Path $out "src")   -Recurse
    Copy-Item (Join-Path $root "icons") (Join-Path $out "icons") -Recurse
    Copy-Item (Join-Path $root $manifestSource) (Join-Path $out "manifest.json") -Force
    $version = (Get-Content -LiteralPath (Join-Path $out "manifest.json") -Raw | ConvertFrom-Json).version
    $browser = if ($name -eq "chrome") { "Chromium" } else { "Firefox" }
    $archive = Join-Path $root "dist\Better-Canvas-$version-$browser.zip"
    Write-Zip $out $archive
    Write-Host "Built $name -> $out" -ForegroundColor Cyan
    Write-Host "Archive -> $archive" -ForegroundColor Cyan
}

Check-Syntax
Build-Target "chrome"  "manifest.json"
Build-Target "firefox" "manifest.firefox.json"

Write-Host ""
Write-Host "Chrome:  chrome://extensions -> Load unpacked -> dist\chrome"
Write-Host "Firefox: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> dist\firefox\manifest.json"
