# Changelog

## Unreleased

### Security

- Expo SDK 57 patch updates and `npm audit fix`; clears the critical `shell-quote` advisory.
- CI audit gate (`npm run audit:gate`) with expiring exceptions in `.github/audit-allowlist.json`.

### Phase 9

- Match screen Worm tab: both innings on one chart.

### Phase 8

- Match scorecard lists partnerships.
- Android preview APK runbook (`docs/ANDROID.md`). The live site is unchanged.

### Phase 7 (not live)

- Old `#match=` links redirect to `/match/<id>` once the new site is hosted.
- Cutover runbook and `firebase.cutover.json`. Production is unchanged until you run those commands.

### Phase 6

- Release workflow: web export, SBOM, provenance; optional Hosting preview channel (not live v1).
- Privacy policy (`/privacy` and `/privacy.html`) and in-app account deletion.
- EAS `preview` profile for a shareable Android APK.

## 2.0.0-alpha.0

- Expo app through Phase 5 (viewer, scorer, admin, hardening) on `main`.
