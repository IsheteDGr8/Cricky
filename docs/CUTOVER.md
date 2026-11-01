# Cutover (Phase 7) — done 2026-10-31

https://cricky-cricket-analysis.web.app now serves the Expo app (`dist/`) with
`firebase/database.rules.json`. `firebase.json` is that config; the v1 site and
rules are kept in `firebase.legacy.json` for rollback only.

## What was run

```sh
npx firebase database:get / --project cricky-cricket-analysis -o backups/rtdb-cutover-2026-10-31.json
npm run migrate:dry-run -- backups/rtdb-cutover-2026-10-31.json
npm run export:web
npx firebase deploy --only hosting,database --project cricky-cricket-analysis
npx firebase database:set / backups/rtdb-cutover-2026-10-31.migrated.json --project cricky-cricket-analysis --force
```

Dry run: 11 matches exact, 1 known bowler-wicket difference, 2 skipped (test
matches whose teams were deleted, one an abandoned Feb 25 game). `/roles/<uid>`
= `"owner"` was set for the club's Google account.

Keep `backups/rtdb-cutover-2026-10-31.json`. It is the only copy of the v1 data.
`backups/` is gitignored.

## Publishing updates

```sh
npm run deploy:web            # export + Hosting only
```

Rules change rarely; deploy them with `--only database` after `npm run test:rules`.

## Rollback (v1 site and data)

v1 cannot read the new layout, so restore the data with the site:

```sh
npx firebase database:set / backups/rtdb-cutover-2026-10-31.json --project cricky-cricket-analysis
npx firebase deploy --config firebase.legacy.json --only hosting,database --project cricky-cricket-analysis
```

Anything scored on the new app after the cutover is lost by a rollback; back it
up first with `database:get`.

## After a week

- Disable or delete `admin@cricky-cricket-analysis.web.app` in Authentication.
- Optionally delete `legacy/` and `firebase.legacy.json` in a later PR.
- Then you may enforce App Check (`docs/KEYS.md`).
