MedDef downloads (multi-platform)
=================================

manifest.json — single source of truth for all platform artifacts.
version.json  — legacy Android-only slice (kept for older clients).

Artifacts (place binaries here):
  meddef.apk           Android (available)
  meddef-macos.dmg     macOS (when built)
  meddef-setup.exe     Windows (when built)
  meddef-linux.AppImage Linux (when built)

iOS: set platforms.ios.status to "coming_soon" until TestFlight/App Store release is ready.

Linux: platforms.linux.status must be "coming_soon" with url null (no download link).

After mobile release bump:
  cd ../meddef_mobile && node scripts/sync-version-json.js

Production origin (no trailing slash): https://meddef.ekddigital.com

Paths (relative to origin):
  /downloads                  — OS-aware downloads hub
  /downloads/meddef.apk       — Android APK
  /downloads/manifest.json    — static manifest (multi-platform)
  /downloads/version.json     — legacy Android-only (in-app update)
  /api/downloads-manifest     — JSON API (same as manifest)
  /api/mobile-version         — legacy Android slice for in-app update

Examples:
  https://meddef.ekddigital.com/downloads
  https://meddef.ekddigital.com/downloads/manifest.json
