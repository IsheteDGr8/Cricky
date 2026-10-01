# Cutover (Phase 7)

This is the day you turn off the v1 site and turn on the Expo app **and** the
new database layout. Until you run the commands in §4, nothing live changes.

Merging this PR only adds the `#match=` redirect and this checklist. CI never
deploys `firebase.cutover.json`.

## 1. Pick a quiet window

Tell everyone: no scoring on the old site until you say it is back. A live
match during cutover will be lost.

## 2. Backup

```sh
npx firebase login
npx firebase database:get / --project cricky-cricket-analysis > backups/rtdb-cutover.json
```

Keep that file. It is gitignored.

## 3. Dry-run the migration

```sh
npm run migrate:dry-run -- backups/rtdb-cutover.json
```

Read the report. You want every real match `OK` or a `DIFF` you already
understand (see [`MIGRATION.md`](MIGRATION.md)). `SKIP` is only for deleted
test teams.

If the report looks wrong, **stop**. Do not deploy.

## 4. Flip (about five minutes)

v1 stops working at the first deploy. Have the migrated file ready
(`backups/rtdb-cutover.migrated.json`).

```sh
npm run export:web
npm run cutover:check

# New rules + new website (replaces v1 Hosting)
npx firebase deploy --config firebase.cutover.json --only hosting,database --project cricky-cricket-analysis

# Load migrated data (admin SDK / CLI bypasses rules)
npx firebase database:set / backups/rtdb-cutover.migrated.json --project cricky-cricket-analysis --confirm
```

Then in the [Realtime Database data viewer](https://console.firebase.google.com/project/cricky-cricket-analysis/database):

1. Add `/roles/<your-google-uid>` = `"owner"` (string).
   Your uid is on **Authentication → Users** after you sign in with Google on
   the new site once (or look up the existing Google account).
2. Do **not** delete the PIN account yet.

## 5. Check

- https://cricky-cricket-analysis.web.app shows the Expo tabs, not the old purple v1 shell.
- A known match opens at `/match/<id>`.
- An old link `…/#match=<id>` jumps to `/match/<id>`.
- You can Google-sign-in as admin.
- A viewer (signed out) can still read scores.

If Hosting is wrong but data is fine: `npx firebase deploy --only hosting --project cricky-cricket-analysis` still uses `firebase.json` (v1). To put the new site back, deploy hosting with `--config firebase.cutover.json` again.

If you must undo Hosting only (data already new): the old site cannot score on the new schema. Restore the backup instead:

```sh
npx firebase database:set / backups/rtdb-cutover.json --project cricky-cricket-analysis --confirm
npx firebase deploy --only hosting,database --project cricky-cricket-analysis
```

That last line uses `firebase.json` (v1 files + legacy rules).

## 6. After a week

- Disable or delete `admin@cricky-cricket-analysis.web.app` in Authentication.
- Optionally delete `legacy/` in a later PR once you are sure.
- Then you may enforce App Check (`docs/KEYS.md`).

## What you do not run

- `firebase deploy` with no `--config` after you have been living on cutover
  (it would publish v1 files again unless you have already changed `firebase.json`).
- Dependabot merges on cutover day.
- App Check **Enforce**.
