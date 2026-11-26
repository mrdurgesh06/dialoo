# Dialoo Android builder (Windows PowerShell). Run from apps\mobile:
#   .\build-android.ps1 -Target emulator      -> debug APK for testing (talks to http://10.0.2.2:8080)
#   .\build-android.ps1 -Target release-apk   -> signed APK to install on a phone
#   .\build-android.ps1 -Target release-aab   -> signed .aab to upload to Google Play
param([ValidateSet('emulator','release-apk','release-aab')][string]$Target = 'emulator')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm install --prefix ..\web
npm install
if ($Target -eq 'emulator') { npm run android:sync:dev } else { npm run android:sync }
if ($LASTEXITCODE -ne 0) { throw 'Web build / sync failed' }
Set-Location android
switch ($Target) {
  'emulator'    { .\gradlew.bat assembleDebug;  $out = 'android\app\build\outputs\apk\debug\app-debug.apk' }
  'release-apk' { .\gradlew.bat assembleRelease; $out = 'android\app\build\outputs\apk\release\app-release.apk' }
  'release-aab' { .\gradlew.bat bundleRelease;   $out = 'android\app\build\outputs\bundle\release\app-release.aab' }
}
if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
Write-Host "`nDONE. Output: apps\mobile\$out" -ForegroundColor Green
