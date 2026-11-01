# Beta site (old and new app side by side)

The v1 site keeps running at https://cricky-cricket-analysis.web.app on the default database
with the legacy rules. The new app runs at **https://cricky-v2.web.app** on its own database
(`cricky-v2-rtdb`) with the new rules. The two never share data: v1 and v2 store
`tournaments`, `teams` and `matches` in different shapes, and a database has one set of rules.

Use v1 for real tournaments until you trust v2. Score practice matches on v2.

Nothing here touches the live site or the default database. `firebase.beta.json` can only deploy
to the `cricky-v2` site and the `cricky-v2-rtdb` instance; `npm run beta:check` refuses anything
else, and `npm run cutover:check` refuses a beta build.

## One-time setup (about 15 minutes)

```sh
npx firebase login

# 1. A second website and a second database in the same project
npx firebase hosting:sites:create cricky-v2 --project cricky-cricket-analysis
npx firebase database:instances:create cricky-v2-rtdb --location us-central1 --project cricky-cricket-analysis
```

2. In the console, open **Authentication → Settings → Authorized domains**. If `cricky-v2.web.app`
   is not listed, add it. Google sign-in fails on the beta site without it.

```sh
# 3. Copy today's v1 data (read-only) and convert it
npx firebase database:get / --project cricky-cricket-analysis -o backups/rtdb-beta.json
npm run migrate:dry-run -- backups/rtdb-beta.json

# 4. Build, then deploy the beta site and the new rules to the beta database
npm run export:beta
npm run beta:deploy

# 5. Load the converted copy into the beta database
npm run beta:load -- backups/rtdb-beta.migrated.json
```

`beta:load` always passes `--instance cricky-v2-rtdb`. The prompt shows the database it is about
to overwrite; it must say `cricky-v2-rtdb`. Never run `firebase database:set` by hand without
`--instance cricky-v2-rtdb`, because that writes to the live v1 database.

6. Open https://cricky-v2.web.app, tap **ADMIN** and sign in with Google once. Copy your uid from
   **Authentication → Users**. In the [Realtime Database console](https://console.firebase.google.com/project/cricky-cricket-analysis/database),
   switch the database picker to **cricky-v2-rtdb**, then add `roles/<your-uid>` = `"owner"`.

## Updating the beta after a merge

```sh
git checkout main
git pull
npm run export:beta
npm run beta:deploy
```

Data on the beta stays put. To refresh it with newer v1 matches, repeat steps 3 and 5. That
replaces everything on the beta, including your role, so redo step 6.

## Later: the real switch

When v2 has handled a real event, follow [`CUTOVER.md`](CUTOVER.md) with a fresh backup. Run
`npm run export:web` (not `export:beta`) first; `cutover:check` stops you otherwise. After the
switch you can delete the beta site and database in the console.
