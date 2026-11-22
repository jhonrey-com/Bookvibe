<#
.SYNOPSIS
Installs Bookvibe from the latest GitHub release, or clones and runs the desktop source build during beta testing.
.EXAMPLE
irm https://raw.githubusercontent.com/jhonrey-com/Bookvibe/main/scripts/install.ps1 | iex
#>
param(
    [switch]$FromSource,
    [string]$InstallDir = "$env:LOCALAPPDATA\Bookvibe"
)

$ErrorActionPreference = "Stop"
$Repo = "jhonrey-com/Bookvibe"

Write-Host "Bookvibe Terminal Installer (jhonrey.com)" -ForegroundColor Gray

if (-not $FromSource) {
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "BookvibeInstaller" }
        $asset = $release.assets | Where-Object { $_.name -match "\.(msi|exe)$" } | Select-Object -First 1
        if ($asset) {
            New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
            $target = Join-Path $InstallDir $asset.name
            Write-Host "Downloading $($asset.name)..."
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $target
            if ($target.EndsWith(".msi")) {
                Start-Process msiexec.exe -ArgumentList "/i `"$target`" /passive" -Wait
            } else {
                Start-Process $target
            }
            Write-Host "Bookvibe installed cleanly."
            exit 0
        }
    } catch {
        Write-Host "No public Windows installer asset is published yet (beta testing stage)." -ForegroundColor Yellow
    }
}

Write-Host "Installing from source into $InstallDir..."
foreach ($tool in @("git", "npm")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Error "Required tool '$tool' was not found on PATH. Install Git and Node.js 22+ to run Bookvibe during beta."
    }
}

if (Test-Path (Join-Path $InstallDir ".git")) {
    git -C $InstallDir pull --ff-only
} else {
    git clone "https://github.com/$Repo.git" $InstallDir
}

Push-Location $InstallDir
try {
    npm install
    Write-Host ""
    Write-Host "Bookvibe source workspace is ready at $InstallDir"
    Write-Host "Run 'npm run dev' (browser) or 'npm run tauri:dev' (desktop) inside $InstallDir."
} finally {
    Pop-Location
}
