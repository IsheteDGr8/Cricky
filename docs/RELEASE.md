# Release (Phase 6)

How the new web app is built and how it will be published. The **live** site at
https://cricky-cricket-analysis.web.app still serves `legacy/` until Phase 7.

## What is live today

| Thing               | File / command                                               |
| ------------------- | ------------------------------------------------------------ |
| Hosting files       | `legacy/` (`firebase.json` `"public": "legacy"`)             |
| Database rules      | `firebase/legacy.rules.json`                                 |
| New app (local)     | `npm run web` or `npm run web:emulator`                      |
| New app (export)    | `npm run export:web` → `dist/`                               |
| Next Hosting config | `firebase.next.json` (used for previews and, later, cutover) |

`firebase deploy` without extra flags still deploys v1. That is intentional.

## Preview the new website (does not replace v1)

```sh
npm run export:web
npx firebase hosting:channel:deploy next --config firebase.next.json --expires 7d
```

Firebase prints a `*.web.app` preview URL. Share that to review the Expo app
against production data (read-only for viewers). Do not run this against a
migrated schema until cutover.

## GitHub Actions

[`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **Every tag `v*`** (and manual **Run workflow**): export the web app, attach
   an SBOM, and write a build-provenance attestation.
2. **Manual “Deploy preview”** (GitHub **Actions → Release → Run workflow**):
   after you approve the `production` environment, deploys `dist/` to the
   Hosting **preview channel** `next` using Workload Identity Federation.

It never deploys `firebase/database.rules.json` and never overwrites live
Hosting unless you later change the workflow for Phase 7.

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

Follow [`CUTOVER.md`](CUTOVER.md). Do not use `firebase.next.json` for the live
flip — that file still points at legacy rules. The operator file is
`firebase.cutover.json`.
