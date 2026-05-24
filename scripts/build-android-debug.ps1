$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$JavaHome = "D:\Push\jdk-21\jdk-21.0.11+10"
$AndroidHome = "D:\Push\AndroidSdk"
$GradleUserHome = "D:\Push\GradleHome"
$AndroidUserHome = "D:\Push\AndroidUserHome"

if (!(Test-Path $JavaHome)) {
  throw "JDK 21 introuvable: $JavaHome"
}

if (!(Test-Path $AndroidHome)) {
  throw "Android SDK introuvable: $AndroidHome"
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:ANDROID_SDK_ROOT = $AndroidHome
$env:GRADLE_USER_HOME = $GradleUserHome
$env:ANDROID_USER_HOME = $AndroidUserHome
$env:Path = "$JavaHome\bin;$AndroidHome\cmdline-tools\latest\bin;$AndroidHome\platform-tools;$env:Path"

Push-Location $ProjectRoot
try {
  npm.cmd run build
  npx.cmd cap sync android
  Push-Location "android"
  try {
    .\gradlew.bat assembleDebug
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
