<#
.SYNOPSIS
Signs Windows desktop release binaries and installers for Quillvibe under publisher "jhonrey.com".

.DESCRIPTION
Finds or creates a local CurrentUser code-signing certificate for CN=jhonrey.com,
exports only the public certificate (.cer) alongside the bundle artifacts, and applies
SHA-256 Authenticode signatures to quillvibe.exe, NSIS setup executables, and MSI packages.
#>
param(
    [string]$BundleRoot = (Join-Path $PSScriptRoot "..\src-tauri\target\release")
)

$ErrorActionPreference = "Stop"

$Subject = "CN=jhonrey.com"
$Now = Get-Date
$Cert = Get-ChildItem -Path "Cert:\CurrentUser\My" -CodeSigningCert |
    Where-Object { $_.Subject -eq $Subject -and $_.NotAfter -gt $Now.AddDays(30) } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $Cert) {
    Write-Host "Creating local code-signing certificate for $Subject..."
    $Cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -FriendlyName "jhonrey.com Code Signing (Quillvibe)" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -HashAlgorithm SHA256 `
        -NotAfter $Now.AddYears(5)
}

# Add to CurrentUser\TrustedPublisher only if missing (adding to CurrentUser\Root triggers a blocking GUI dialog on Windows)
$TpStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "CurrentUser")
$TpStore.Open("ReadWrite")
if (-not ($TpStore.Certificates | Where-Object { $_.Thumbprint -eq $Cert.Thumbprint })) {
    $TpStore.Add($Cert)
}
$TpStore.Close()

$BundleDir = Join-Path $BundleRoot "bundle"
New-Item -ItemType Directory -Force -Path $BundleDir | Out-Null
$PublicCerPath = Join-Path $BundleDir "jhonrey.com-Quillvibe.cer"
Export-Certificate -Cert $Cert -FilePath $PublicCerPath -Type CERT -Force | Out-Null
Write-Host "Exported public certificate: $PublicCerPath (Thumbprint: $($Cert.Thumbprint))"

$Targets = @()
$MainExe = Join-Path $BundleRoot "quillvibe.exe"
if (Test-Path $MainExe) { $Targets += Get-Item $MainExe }

$NsisDir = Join-Path $BundleDir "nsis"
if (Test-Path $NsisDir) { $Targets += Get-ChildItem -Path $NsisDir -Filter "*.exe" }

$MsiDir = Join-Path $BundleDir "msi"
if (Test-Path $MsiDir) { $Targets += Get-ChildItem -Path $MsiDir -Filter "*.msi" }

if ($Targets.Count -eq 0) {
    throw "No compiled Windows binaries or installers found under $BundleRoot."
}

foreach ($File in $Targets) {
    Write-Host "Signing $($File.FullName)..."
    $Sig = Set-AuthenticodeSignature -FilePath $File.FullName -Certificate $Cert -HashAlgorithm SHA256 -TimestampServer "http://timestamp.digicert.com" -ErrorAction SilentlyContinue
    if (-not $Sig -or ($Sig.Status -notin @("Valid", "UnknownError"))) {
        # Retry without external timestamp server if network timestamping is unavailable
        $Sig = Set-AuthenticodeSignature -FilePath $File.FullName -Certificate $Cert -HashAlgorithm SHA256
    }
    $Check = Get-AuthenticodeSignature -FilePath $File.FullName
    Write-Host "  Status=$($Check.Status) Subject=$($Check.SignerCertificate.Subject) SHA256=$((Get-FileHash $File.FullName -Algorithm SHA256).Hash)"
    if ($Check.Status -eq "HashMismatch" -or -not $Check.SignerCertificate) {
        throw "Signature verification failed for $($File.FullName): $($Check.Status)"
    }
}
