param(
  [switch]$UploadSupabase,
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
$SupabaseBucketPath = "ss:///app-downloads/apk"

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
if (!$BuildStamp) {
  $BuildStamp = Get-Date -Format "yyyyMMdd-HHmmss"
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

  npm.cmd run build
  npx.cmd cap sync android

  $NestedApks = @()
  if (Test-Path $AndroidPublicDir) {
    $NestedApks = @(Get-ChildItem -LiteralPath $AndroidPublicDir -Recurse -Filter "*.apk" -File -ErrorAction SilentlyContinue)
  }
  if ($NestedApks.Count -gt 0) {
    $NestedApks | ForEach-Object { Write-Host "APK imbrique detecte: $($_.FullName)" }
    throw "Des APK sont presents dans les assets Android. Nettoie public/downloads avant cap sync."
  }

  Push-Location "android"
  try {
    .\gradlew.bat clean assembleDebug
  } finally {
    Pop-Location
  }

  $ApkName = "travelbudget-$Version-$BuildStamp-debug.apk"
  $SourceApk = Join-Path $ProjectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
  $TargetApk = Join-Path $DownloadsDir $ApkName

  if (!(Test-Path $SourceApk)) {
    throw "APK genere introuvable: $SourceApk"
  }

  Copy-Item -LiteralPath $SourceApk -Destination $TargetApk -Force
  Write-Host "APK pret: $TargetApk"

  if ($UploadSupabase) {
    $LocalUploadPath = "public\downloads\$ApkName"
    $RemotePath = "$SupabaseBucketPath/$ApkName"
    supabase --experimental storage cp --content-type "application/vnd.android.package-archive" $LocalUploadPath $RemotePath
    Write-Host "APK Supabase Storage: https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/$ApkName"
  }
} finally {
  Pop-Location
}
