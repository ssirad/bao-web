#!/bin/bash
# Gira su Codemagic, dopo "npx cap sync ios".
# Mette nel progetto Xcode quello che su un Mac faresti a mano: nome sotto l'icona,
# icona di BAO e la dichiarazione sulla crittografia per Apple.
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

echo "BAO: nome, icona e crittografia sistemati."
