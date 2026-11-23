#!/usr/bin/env bash
# Dialoo Android builder (Mac/Linux). Usage: ./build-android.sh emulator|release-apk|release-aab
set -euo pipefail
cd "$(dirname "$0")"
T="${1:-emulator}"
npm install --prefix ../web
npm install
if [ "$T" = emulator ]; then npm run android:sync:dev; else npm run android:sync; fi
cd android
case "$T" in
  emulator)    ./gradlew assembleDebug;   OUT=android/app/build/outputs/apk/debug/app-debug.apk ;;
  release-apk) ./gradlew assembleRelease; OUT=android/app/build/outputs/apk/release/app-release.apk ;;
  release-aab) ./gradlew bundleRelease;   OUT=android/app/build/outputs/bundle/release/app-release.aab ;;
  *) echo "Usage: $0 emulator|release-apk|release-aab"; exit 1 ;;
esac
echo "DONE. Output: apps/mobile/$OUT"
