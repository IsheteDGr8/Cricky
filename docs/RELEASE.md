# Release

How the web app is built and published. https://cricky-cricket-analysis.web.app
serves the Expo app since the cutover on 2026-10-31 ([`CUTOVER.md`](CUTOVER.md)).

## What is live today

| Thing          | File / command                                          |
| -------------- | ------------------------------------------------------- |
| Hosting files  | `dist/` from `npm run export:web` (`firebase.json`)     |
| Database rules | `firebase/database.rules.json`                          |
| Local app      | `npm run web` or `npm run web:emulator`                 |
| Publish site   | `npm run deploy:web`                                    |
| v1 rollback    | `firebase.legacy.json` (see [`CUTOVER.md`](CUTOVER.md)) |

## Preview before publishing

```sh
npm run export:web
npx firebase hosting:channel:deploy next --expires 7d
```

Firebase prints a `*.web.app` preview URL that reads live data. Check it, then
`npm run deploy:web`.

## GitHub Actions

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **Every tag `v*`** (and manual **Run workflow**): export the web app, attach
   an SBOM, and write a build-provenance attestation.
2. **Manual “Deploy preview”** (GitHub **Actions → Release → Run workflow**):
   after you approve the `production` environment, deploys `dist/` to the
   Hosting **preview channel** `next` using Workload Identity Federation.

It never deploys database rules and never overwrites live Hosting; publishing
stays a manual `npm run deploy:web`.

### One-time: GitHub environment

1. Repo **Settings → Environments → New environment**
2. Name: `production`
3. **Required reviewers**: yourself
4. Save

### One-time: Workload Identity Federation (no JSON keys)

1. In Google Cloud, enable **IAM Credentials API**.
2. Create a service account, e.g. `github-deploy@cricky-cricket-analysis.iam.gserviceaccount.com`.
3. Grant it **Firebase Hosting Admin** (enough for preview and later Hosting).
   Do **not** grant it permission to change database rules until cutover.
4. Follow
   [Google’s GitHub WIF guide](https://github.com/google-github-actions/auth#preferred-direct-workload-identity-federation)
   so the GitHub repo `IsheteDGr8/Cricky` can impersonate that account.
5. Repo **Settings → Secrets and variables → Actions**:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` — full provider resource name
   - `GCP_SERVICE_ACCOUNT` — the service account email

Until those secrets exist, the preview job prints “WIF not configured” and
exits 0. The SBOM job still runs.

## Android APK (optional, free)

See [`ANDROID.md`](ANDROID.md). Short version:

```sh
npm install -g eas-cli
eas login
eas init
eas build -p android --profile preview
```

Credentials stay in Expo’s account, not this repo. Play Store is still skipped.

## iOS

Wait for the friend’s Apple Developer access. Then follow Phase 6 in
[`PRODUCTION_PLAN.md`](PRODUCTION_PLAN.md).

## Cutover (Phase 7)

Done on 2026-10-31. See [`CUTOVER.md`](CUTOVER.md) for what was run and how to roll back.
