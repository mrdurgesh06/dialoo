#!/usr/bin/env bash
# Dialoo iOS helper - MAC ONLY (Xcode required). Usage: ./build-ios.sh simulator | release
set -euo pipefail
cd "$(dirname "$0")"
[ "$(uname)" = "Darwin" ] || { echo "iOS apps can only be built on a Mac with Xcode. See docs/MOBILE-APP.md (cloud Mac options)."; exit 1; }
npm install --prefix ../web
npm install
if [ "${1:-simulator}" = release ]; then npm run ios:sync; else npm run ios:sync:dev; fi
npx cap open ios
echo "Xcode opened. Choose a Simulator (or your iPhone) at the top and press Run (▶). For App Store: Product > Archive."
