#!/bin/bash
# Gira su Codemagic, dopo "npx cap sync ios".
# Mette nel progetto Xcode quello che su un Mac faresti a mano: nome sotto l'icona,
# icona di BAO, la dichiarazione sulla crittografia e iOS minimo 15.0 (richiesto da Apple).
set -euo pipefail

PLIST=ios/App/App/Info.plist
ICONSET=ios/App/App/Assets.xcassets/AppIcon.appiconset
PB=/usr/libexec/PlistBuddy

# nome sotto l'icona
$PB -c "Set :CFBundleDisplayName BAO" "$PLIST" 2>/dev/null || $PB -c "Add :CFBundleDisplayName string BAO" "$PLIST"

# BAO usa solo la crittografia standard di HTTPS: niente documenti sull'esportazione
$PB -c "Delete :ITSAppUsesNonExemptEncryption" "$PLIST" 2>/dev/null || true
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"

# icona: una sola immagine da 1024 px, Xcode ricava le altre misure
rm -f "$ICONSET"/*.png
cp resources/app-icon-1024.png "$ICONSET/AppIcon-1024.png"
cat > "$ICONSET/Contents.json" <<'JSON'
{
  "images" : [
    { "filename" : "AppIcon-1024.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON

# iOS minimo 15.0: Apple non accetta piu' app per iOS 14 (avviso ITMS-90068)
MIN_IOS=15.0
sed -i '' -E "s/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = $MIN_IOS;/g" ios/App/App.xcodeproj/project.pbxproj
if [ -f ios/App/Podfile ]; then
  sed -i '' -E "s/^platform :ios, .*/platform :ios, '$MIN_IOS'/" ios/App/Podfile
  (cd ios/App && pod install)
fi
grep -q "IPHONEOS_DEPLOYMENT_TARGET = $MIN_IOS;" ios/App/App.xcodeproj/project.pbxproj

echo "BAO: nome, icona, crittografia e iOS $MIN_IOS sistemati."
