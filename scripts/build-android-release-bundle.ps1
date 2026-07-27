param(
  [switch]$RequireSigned,
  [string]$BuildStamp = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$JavaHome = "D:\Push\jdk-21\jdk-21.0.11+10"
$AndroidHome = "D:\Push\AndroidSdk"
$GradleUserHome = "D:\Push\GradleHome"
$AndroidUserHome = "D:\Push\AndroidUserHome"
$PackageJsonPath = Join-Path $ProjectRoot "package.json"
$DownloadsDir = Join-Path $ProjectRoot "public\downloads"
$AndroidPublicDir = Join-Path $ProjectRoot "android\app\src\main\assets\public"

function Get-Sha256Hash {
  param([string]$Path)
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  }
  $CertutilOutput = certutil.exe -hashfile $Path SHA256
  $HashLine = @($CertutilOutput | Where-Object { $_ -match '^[0-9a-fA-F ]{64,}$' } | Select-Object -First 1)
  if (!$HashLine) {
    throw "Impossible de calculer le SHA-256 pour $Path"
  }
  return ($HashLine -replace '\s', '').ToUpperInvariant()
}

if (!(Test-Path $JavaHome)) {
  throw "JDK 21 introuvable: $JavaHome"
}

if (!(Test-Path $AndroidHome)) {
  throw "Android SDK introuvable: $AndroidHome"
}

$Version = (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
if (!$Version) {
  throw "Version introuvable dans package.json"
}
if (!$BuildStamp -or $BuildStamp -notmatch '^\d{8}-\d{6}$') {
  $BuildStamp = Get-Date -Format "yyyyMMdd-HHmmss"
}

$SigningVars = @(
  "TB_ANDROID_KEYSTORE_PATH",
  "TB_ANDROID_KEYSTORE_PASSWORD",
  "TB_ANDROID_KEY_ALIAS",
  "TB_ANDROID_KEY_PASSWORD"
)
$MissingSigningVars = @($SigningVars | Where-Object { -not [Environment]::GetEnvironmentVariable($_) })
$HasSigning = $MissingSigningVars.Count -eq 0

if ($RequireSigned -and !$HasSigning) {
  throw "Signature release manquante. Variables requises: $($MissingSigningVars -join ', ')"
}

if ($HasSigning) {
  $KeystorePath = [Environment]::GetEnvironmentVariable("TB_ANDROID_KEYSTORE_PATH")
  if (!(Test-Path $KeystorePath)) {
    throw "Keystore release introuvable: $KeystorePath"
  }
} else {
  Write-Warning "Aucune signature release configuree. L'AAB sera genere pour controle local, pas pour soumission Play Store."
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:ANDROID_SDK_ROOT = $AndroidHome
$env:GRADLE_USER_HOME = $GradleUserHome
$env:ANDROID_USER_HOME = $AndroidUserHome
$env:Path = "$JavaHome\bin;$AndroidHome\cmdline-tools\latest\bin;$AndroidHome\platform-tools;$env:Path"

Push-Location $ProjectRoot
try {
  New-Item -ItemType Directory -Path $DownloadsDir -Force | Out-Null
  Get-ChildItem -LiteralPath $DownloadsDir -Filter "*.apk" -File -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem -LiteralPath $DownloadsDir -Filter "*.aab" -File -ErrorAction SilentlyContinue | Remove-Item -Force

  npm.cmd run build
  npx.cmd cap sync android

  $NestedPackages = @()
  if (Test-Path $AndroidPublicDir) {
    $NestedPackages = @(Get-ChildItem -LiteralPath $AndroidPublicDir -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @(".apk", ".aab") })
  }
  if ($NestedPackages.Count -gt 0) {
    $NestedPackages | ForEach-Object { Write-Host "Package imbrique detecte: $($_.FullName)" }
    throw "Des packages Android sont presents dans les assets Android. Nettoie public/downloads avant cap sync."
  }

  Push-Location "android"
  try {
    .\gradlew.bat clean bundleRelease
  } finally {
    Pop-Location
  }

  $BundleName = "travelbudget-$Version-$BuildStamp-release.aab"
  $SourceBundle = Join-Path $ProjectRoot "android\app\build\outputs\bundle\release\app-release.aab"
  $TargetBundle = Join-Path $DownloadsDir $BundleName

  if (!(Test-Path $SourceBundle)) {
    throw "AAB genere introuvable: $SourceBundle"
  }

  Copy-Item -LiteralPath $SourceBundle -Destination $TargetBundle -Force
  Write-Host "AAB pret: $TargetBundle"

  $Size = (Get-Item -LiteralPath $TargetBundle).Length
  $Hash = Get-Sha256Hash -Path $TargetBundle
  Write-Host "AAB taille: $Size octets"
  Write-Host "AAB SHA256: $Hash"

  if ($HasSigning) {
    jarsigner.exe -verify -certs $TargetBundle | Out-Host
  }
} finally {
  Pop-Location
}
