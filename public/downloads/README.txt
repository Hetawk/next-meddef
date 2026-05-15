Place meddef.apk here after EAS build
=====================================

1. Build an Android APK from the mobile app repo (see meddef_mobile/BUILD.md):
   npx eas-cli build -p android --profile preview

2. Download the resulting .apk from the Expo dashboard and save it as:

   next-meddef/public/downloads/meddef.apk

3. Redeploy the site so /downloads/meddef.apk is served.

If the APK is larger than ~50 MB, prefer GitHub Releases (or similar) and
update the download link on src/app/(dashboard)/downloads/page.tsx instead
of committing the binary.
