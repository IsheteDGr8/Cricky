# Android APK (Phase 8)

A shareable `.apk` you can send to scorers and viewers. **No Play Store fee.**
The live website stays v1 until you run [`CUTOVER.md`](CUTOVER.md).

This PR does not run `eas build`. You do that once, from your machine.

## 1. One-time Expo account

1. Create a free account at [https://expo.dev/signup](https://expo.dev/signup).
2. In this repo:

```sh
npm install -g eas-cli
eas login
eas init
```

`eas init` writes an Expo project id into `app.json` (`expo.extra.eas.projectId`).
Commit that id in a small follow-up if you want teammates to reuse it. It is not
a secret.

## 2. Build the preview APK

```sh
eas build -p android --profile preview
```

EAS compiles in the cloud (no Android Studio). When it finishes, Expo prints a
download URL. Install that APK on a phone (allow “install from unknown sources”
once).

The Firebase web config is already in `src/data/config.ts`, so the APK talks to
the same project as the website. Until cutover, that is still the v1 data
layout — viewers can browse after you flip, not before.

## 3. After the first successful build

Expo **Credentials → Android → fingerprints** shows a SHA-256. Paste it into
[`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json)
in place of `REPLACE_WITH_UPLOAD_KEY_SHA256`, then ship that file with the next
web export. Until then, `https://…` links open in the browser instead of the
app.

## What you skip

- Google Play ($25). Sideload or share the APK.
- iOS / TestFlight — wait for the friend’s Apple Developer access.
- App Check **Enforce**.
- Putting EAS credentials in GitHub. They stay in your Expo account.

## If the build asks questions

- **Generate a new Android Keystore?** Yes (EAS stores it).
- **Google service account / Play?** No.
- **iOS credentials?** Skip; this profile is Android-only.
