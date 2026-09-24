# Cricky: Production Plan

Goal: turn Cricky from a single-file web app into a production-grade cricket scoring app on **iPhone, Android and the web**. It should comfortably handle 100+ people at once, be secure, look professional, and cost $0 to run at this scale.

Repository: [https://github.com/IsheteDGr8/Cricky](https://github.com/IsheteDGr8/Cricky) (public)

---

## 1. Decisions (locked in)

| Topic         | Decision                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Firebase plan | **Blaze** (pay-as-you-go) with a **$1 budget alert**. Same free allowances as Spark; expected bill $0.                             |
| App framework | **Expo (React Native) + TypeScript + Expo Router**: one codebase for iOS, Android and web.                                         |
| Backend       | Firebase Realtime Database, Firebase Auth, Firebase Hosting, App Check (+ Cloud Functions where they help).                        |
| Sign-in       | Admins: **Google / Apple sign-in** once per device. Scorers: **random per-match or per-tournament code**. Viewers: **no sign-in**. |
| Existing data | **Migrate** all tournaments, teams and matches to the new layout (after a full backup).                                            |
| Repo          | Replace the two old files on `main` (they stay in git history). Tag the current app as `v1-legacy`.                                |

---

## 2. Current state (audit)

### What works well (keep the behavior)

- Multiple tournaments running at once, each with its own standings, top-batter and top-bowler lists, group stage and playoffs.
- Quick matches with one-off teams that don't affect tournament stats.
- Ball-by-ball scoring: extras, wickets, strike rotation, over changes, commentary.
- Undo a ball, and undo an innings end or match end.
- Change Player of the Match after picking one.
- Wicket limit based on squad size (squad size − 1).
- Change the overs limit mid-game; add players mid-game.
- Share links that open a specific scorecard (`#match=<id>`).
- Live updates across devices.

### Problems to fix

| #   | Problem                                                                                                                                                                | Severity              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | **The live database rules are fully open.** The locked-down `database.rules.json` was never deployed, so anyone can read every match PIN and write or delete any data. | Critical              |
| 2   | Admin sign-in is a 4-digit PIN (10,000 combinations). The PIN-to-password scheme is visible in the source, which will be public on GitHub.                             | High                  |
| 3   | The free Spark plan limits the database to **100 connections at once** across the whole project.                                                                       | High (fixed by Blaze) |
| 4   | Every ball rewrites the whole match record, including the undo history, and every viewer downloads all of it again. That wastes bandwidth and doesn't scale.           | High                  |
| 5   | Standings, net run rate and player stats are counters changed step by step, and undo/delete reverse them by hand, which drifts and breaks.                             | High                  |
| 6   | One 3,100-line `app.js` with global state, HTML built from strings, and no tests.                                                                                      | Medium                |
| 7   | No input validation in the database rules (types, lengths, ranges).                                                                                                    | Medium                |
| 8   | No crash reporting, monitoring, automated checks, or version control.                                                                                                  | Medium                |

---

## 3. Target architecture

```
                    +-----------------------------+
                    |  Expo app (TypeScript)      |
                    |  iOS  |  Android  |  Web    |
                    +--------------+--------------+
                                   |
            +----------------------+-----------------------+
            |                      |                       |
   Firebase Auth           Realtime Database        Firebase Hosting
   (Google/Apple for       (live scores,            (web app + PWA,
    admins; anonymous      strict rules)             security headers)
    session for scorers)            |
            |              Cloud Functions (optional:
        App Check          scorer-code redemption rate
   (App Attest / Play      limiting, match-finalize summaries)
    Integrity / reCAPTCHA)
```

### Why Expo

- One codebase ships real native apps plus a website.
- **EAS Build compiles iOS apps in the cloud**, so no Mac is needed (this project is developed on Windows).
- EAS Submit uploads to App Store Connect and Google Play; EAS Update pushes JavaScript fixes over the air without a store review.
- Apple rejects apps that are just a website in a wrapper (guideline 4.2); a real React Native app avoids that.

### Why not Next.js

It's a web-only framework: it wouldn't give phone apps, and its server features need paid hosting.

---

## 4. Project structure

```
cricky/
  src/
    app/                       Expo Router screens
      (tabs)/                  Tournaments, Matches, Leaderboards, More
      tournament/[id]/         Standings, Matches, Squads, Stats, Playoffs, Manage
      match/[id].tsx           Live scorecard + commentary + summary (viewer)
      score/[id].tsx           Scoring pad (scorer only)
      admin/                   Admin-only screens
    domain/                    PURE TypeScript: no Firebase, no React
      scoring/                 events, rules, engine (applyEvent/replay), result, selectors, commentary
      stats/                   match summaries, standings + net run rate, leaderboards
      playoffs/                bracket formats and resolution
      __fixtures__/            shared test builders (tests sit in each folder's __tests__/)
    data/                      the ONLY layer that imports Firebase
      firebase.ts              init, App Check, auth
      repositories/            tournaments, teams, matches, events, summaries, roles
      schemas/                 zod schemas for every record (runtime validation)
    features/                  hooks and screen state per feature
    ui/                        design system
      tokens.ts                colors, spacing, radius, type scale, dark mode
      components/              Button, Card, Sheet, Tabs, ScoreHeader, BallChip, ...
  firebase/
    database.rules.json
    rules.test.ts              rules tests against the Firebase emulator
  scripts/
    backup.ts                  export live DB to backups/ (gitignored)
    migrate/                   old layout -> new layout, with a dry-run mode
  .github/workflows/ci.yml
  app.config.ts  eas.json  firebase.json  package.json  tsconfig.json
```

**Dependency rule:** `app/` → `features/` → `domain/` and `data/`. `domain/` imports nothing app-specific, so it can be tested in isolation. Enforced by ESLint; details in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 5. Data model (new)

Event-sourced matches: every ball is an append-only event. The score, scorecard and commentary are **calculated** from events, never stored as the source of truth.

```
/roles/{uid}                         "owner" | "admin"          (set by owner only)
/tournaments/{tid}                   { name, status, oversDefault, format, createdAt, createdBy }
/tournaments/{tid}/playoffs          bracket state
/teams/{teamId}                      { name, tournamentId, captainId, createdAt }
/teams/{teamId}/players/{pid}        { name, role? }
/matches/{mid}/meta                  { tournamentId|null, isQuick, teamA, teamB, oversLimit,
                                       toss, status, createdAt, createdBy, quickTeams? }
/matches/{mid}/events/{pushId}       { seq, type, ...payload, by, at }
                                       type: ball | wicket | extra | innings_end | match_end |
                                             overs_change | player_added | potm | swap_strike | ...
/matchSummaries/{mid}                { status, score line, overs, result, updatedAt }  (small, for lists)
/matchResults/{mid}                  final batting/bowling cards (written at match end)
/scorers/{mid}/{uid}                 true   (who may add events to this match)
/scorerCodes/{mid}                   { codeHash }   (NOT readable by clients)
/tournamentScorers/{tid}/{uid}       true
```

### Why this layout

- **Bandwidth:** a viewer downloads the event list once, then one small event per ball. List screens read only `matchSummaries`.
- **Undo** is "remove the last event": no snapshots, no hand-written reversal.
- **Stats can't drift:** standings, net run rate and leaderboards are pure functions over `matchResults` in a tournament.
- **Audit trail:** every event records who scored it and when.

---

## 6. Security plan

### Identity and roles

- **Owner/admin:** signs in with Google or Apple (Sign in with Apple is required on iOS if any other social login is offered). The role lives in `/roles/{uid}`, which only the owner can write. The first owner is set once in the Firebase console.
- **Scorer:** gets a random 10-character code from an admin, per match or per tournament. The app signs the scorer in anonymously, and the database rules only allow `/scorers/{mid}/{uid}` to be written when the submitted code matches `/scorerCodes/{mid}`, which clients can't read. A Cloud Function (Blaze) adds rate limiting on code redemption.
- **Viewer:** no account, read-only.

### Database rules

- Default deny at the root.
- Public read only where needed: tournaments, teams, match meta, events, summaries, results.
- `events`: **create only** (no update or delete) by that match's scorers or admins, while the match is live. Undo is an admin/scorer delete of the _last_ event only, enforced by the `seq` field.
- `.validate` on every field: types, string lengths (names ≤ 40 characters), number ranges (runs 0–7, overs 1–50), allowed enum values, and `by == auth.uid`.
- Completed matches are locked except for admins.
- `scorerCodes` are never readable.
- Rules tests (`@firebase/rules-unit-testing` + emulator) run on every pull request: allowed and denied cases for every role.

### Platform

- **App Check:** App Attest / DeviceCheck (iOS), Play Integrity (Android), reCAPTCHA Enterprise (web, free tier). Enforced on the database once rolled out.
- **Hosting headers:** Content-Security-Policy, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none.
- **No secrets in the repo.** The Firebase web config is public by design; security comes from the rules plus App Check.
- GitHub secret scanning, Dependabot and branch protection on `main`.
- Retire the legacy PIN scheme and the `admin@…` PIN account at cutover.

### Immediate fix (before the rebuild ships)

Deploy the locked-down rules to the **current** live app once the PIN account is confirmed to exist in Firebase Auth. Otherwise admins would be locked out of scoring on the live site.

---

## 7. UI and UX standard

- **Design system:** a token-based palette (keep the UW purple and gold as the brand, with neutral surfaces), 4/8-point spacing, a type scale, and light and dark themes.
- No emoji as icons; use a consistent icon set (Lucide / SF Symbols style).
- **Accessibility:** 44×44 pt minimum tap targets, WCAG AA contrast, screen-reader labels, dynamic type, reduced-motion support.
- **Scoring pad:** big buttons, haptics on every ball, a confirmation sheet for wickets and innings end, one-tap undo with an "undo" toast, and a clear sync status (online / queued offline).
- **Viewer:** live score header, over-by-over ball chips, a full scorecard, commentary, partnerships, required run rate and worm chart (later).
- Skeleton loading states, empty states, error states with retry, pull-to-refresh.
- **Deep links:** `https://cricky-cricket-analysis.web.app/match/<id>` opens the app if it's installed (Universal Links / App Links), otherwise the web.
- Native share sheet for scorecards.

---

## 8. Engineering standards

- TypeScript `strict`, ESLint (typescript-eslint, react-hooks), Prettier.
- **Tests:**
  - Jest (`jest-expo`) unit tests; target ≥ 90% coverage for `src/domain`.
  - Rules tests against the emulator.
  - Component tests for key screens (React Native Testing Library).
- **Runtime validation** with zod at the data boundary, so bad data never reaches the UI.
- **Automated checks (GitHub Actions)** on every pull request: install → typecheck → lint → unit tests → rules tests (emulator) → web build.
- **Git workflow:** `main` is protected; feature branches; small pull requests; Conventional Commits; semantic versioning; `CHANGELOG.md`.
- **Monitoring:** Sentry free tier for crashes and errors; Firebase console usage alerts; $1 budget alert.
- **Environments:** `development` (Firebase emulator), `production` (live project). A separate `staging` Firebase project is optional later.

### DevSecOps: security built into every stage

Security is checked automatically at each step from writing code to running it, not bolted on at
the end. Everything below is free for a public repo.

| Stage       | Practice                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan**    | Threat model ([`THREAT_MODEL.md`](THREAT_MODEL.md)) updated whenever a new role, data type or service is added.                                                                                                        |
| **Code**    | Strict TypeScript, ESLint layer boundaries (only `src/data` touches Firebase), zod validation at the data boundary, CODEOWNERS review.                                                                                 |
| **Commit**  | GitHub secret scanning with push protection blocks secrets before they land.                                                                                                                                           |
| **Build**   | CI on every PR: CodeQL static analysis (security-extended), gitleaks secret scan of full history, dependency review (blocks high-severity additions), `npm audit` (high+), `npm audit signatures`.                     |
| **Test**    | Unit tests (≥ 90% domain coverage); database rules tests against the emulator for every role, allowed and denied.                                                                                                      |
| **Release** | Actions pinned to commit SHAs, least-privilege workflow tokens, deploy from CI with keyless Workload Identity Federation (no stored service-account keys), build provenance attestations and an SBOM for each release. |
| **Operate** | App Check, security headers, Sentry, budget alert, OpenSSF Scorecard weekly, Dependabot, incident runbook in [`SECURITY.md`](../SECURITY.md).                                                                          |

Repo settings (done once by the owner in GitHub):

- **Settings → Code security:** enable Dependabot alerts and security updates, secret scanning,
  push protection, and private vulnerability reporting.
- **Settings → Rules → Rulesets** for `main`: require a pull request, require status checks (CI,
  CodeQL, gitleaks, dependency review) to pass, block force pushes and deletion.

---

## 9. Phases

Each phase ships as its own pull request(s) so it can be reviewed and tested.

### Phase 0: Safety and repo

- [x] Back up the live database to `backups/<date>.json` (gitignored).
- [x] Deploy the locked-down rules to the current live app (after confirming the admin PIN account exists).
- [x] Initialize git on top of the existing GitHub history; commit the current app; tag `v1-legacy`.
- [x] Push to `main`.
- [x] Decide the working location: the project stays in its current OneDrive folder. Pause OneDrive syncing during large `npm install`s if it slows things down.

### Phase 1: Foundations

- [x] Scaffold Expo (TypeScript, Expo Router) at the repo root; move the legacy app into `legacy/`.
- [x] ESLint, Prettier, Jest, tsconfig paths, Husky pre-commit (lint-staged).
- [x] GitHub Actions workflow.
- [x] Design tokens, theme provider (light/dark), core UI components.
- [x] Tab navigation shell with placeholder screens.

### Phase 2: Scoring engine (`src/domain`)

- [x] Event types and a reducer: `applyEvent(state, event)`.
- [x] Rules:
  - legal ball, wide, no-ball (+ runs), byes, leg-byes
  - wicket types (bowled, caught, LBW, run out ± runs, stumped, hit wicket, retired)
  - strike rotation
  - over end and bowler change (no consecutive overs)
- [x] Innings end: overs done, wicket limit reached (squad size − 1), target reached, or ended manually.
- [x] Match end, result, ties.
- [x] Mid-game changes: overs, added players.
- [x] Undo through any event, including innings or match end.
- [x] Batting and bowling cards, fall of wickets, partnerships, commentary text.
- [x] Standings (played / won / lost / tied / points) and net run rate (all-out counts as full overs).
- [x] Leaderboards per tournament (quick matches excluded; the caller picks which matches count).
- [x] Playoff bracket generation and advancement.
- [x] Exhaustive tests (180 tests, ≥ 90% coverage enforced).
- [x] Replay real matches from the backup: done by the Phase 3 migration dry run.
- [x] Layer boundaries enforced by ESLint; [`ARCHITECTURE.md`](ARCHITECTURE.md) written.

### Phase 2.5: DevSecOps pipeline

- [x] Security workflow: CodeQL, gitleaks (full history), dependency review.
- [x] CI: `npm audit` (high+), `npm audit signatures`; actions pinned to SHAs; `persist-credentials: false`.
- [x] OpenSSF Scorecard workflow.
- [x] `SECURITY.md` (disclosure policy, incident response), `CODEOWNERS`, `THREAT_MODEL.md`.
- [x] Security headers on the live site; emulator config for local rules testing.
- [x] Found and fixed: the live site allowed anyone to self-register and then write. Writes are now restricted to the admin account.
- [ ] Owner: disable email/password sign-up in Firebase Auth; enable GitHub security settings and the `main` ruleset (see DevSecOps above).

### Phase 3: Backend

- [x] New schema + zod schemas.
- [x] `database.rules.json` rewritten with validation; emulator rules tests (run in CI).
- [x] Auth: Google + Apple sign-in for admins; anonymous sessions for scorers; scorer-code redemption.
- [x] Repositories (typed read/write, live subscriptions), tested end to end against the emulator.
- [ ] Owner: enable the Anonymous, Google and Apple providers in Firebase Auth (needed before cutover).
- [x] Migration script (old → new) with dry run, verified against the backup: replay old ball history into events; rebuild summaries and results; compare totals with the old data. See [`MIGRATION.md`](MIGRATION.md).

### Phase 4: Features

- [x] Viewer: tournaments list, tournament detail (standings, matches, squads, stats, playoffs), match screen (live header, scorecard, commentary, summary), share.
- [x] Scorer: code entry, player selection, scoring pad, wicket/extras sheets, undo, change overs, add player, end innings, Player of the Match.
- [x] Admin: create/edit/archive tournaments, teams and squads, fixtures, start tournament match, start quick match (typed player names, not saved as teams), manage scorers and codes, playoffs, delete with confirmation.
- [x] Deep links (`cricky://`) and Universal / App Links config (host files need the Apple team id and Android signing fingerprint at store release).

### Phase 5: Hardening

- [ ] App Check on all platforms, then enforce.
- [ ] Sentry integration.
- [ ] Offline scoring (queued writes plus a visible sync status).
- [ ] Performance: list virtualization, memoization, subscription cleanup.
- [ ] Accessibility pass.
- [ ] Load test: script 150+ simultaneous viewers against a live match; confirm bandwidth per viewer stays small.
- [ ] Security review of rules and auth flows against the OWASP MASVS (mobile) and ASVS Level 1 (web) checklists.
- [ ] Content-Security-Policy for the new web app (report-only first, then enforced).

### Phase 6: Release

- [ ] **Deploy pipeline:** GitHub Actions deploys rules and web on merge to `main`, authenticated with Workload Identity Federation (no long-lived keys); a protected `production` environment requires the owner's approval.
- [ ] **Release integrity:** build provenance attestations and an SBOM attached to each GitHub release; EAS credentials stored in EAS, never in the repo.
- [ ] **Web:** Expo web export → Firebase Hosting (with PWA manifest and security headers).
- [ ] **Android:** EAS build → APK for direct sharing (free). Optional: Google Play ($25 one-time; new personal accounts need a closed test with 12 testers for 14 days before going public).
- [ ] **iOS** (friend's Apple Developer account):
  1. Friend adds you to **App Store Connect → Users and Access** with the _App Manager_ role (or _Admin_).
  2. Create the app record (bundle ID, e.g. `app.cricky.scorer`).
  3. Friend creates an **App Store Connect API key** for EAS Submit (or runs `eas submit` himself).
  4. `eas build -p ios --profile production` (cloud build, no Mac) → `eas submit -p ios`.
  5. Test through **TestFlight** (internal testers, then external after a quick beta review).
  6. Submit for App Review with screenshots, description, privacy details and a demo account/code for the reviewer.
- [ ] **Store requirements:** privacy policy page (hosted on Firebase Hosting), data-safety / privacy-nutrition forms, app icons and splash, screenshots. Account deletion in-app if users can create accounts (admins/scorers).

### Phase 7: Cutover

- [ ] Freeze scoring on the legacy app.
- [ ] Final backup → run migration → verify.
- [ ] Deploy the new rules, the new web app and the mobile releases.
- [ ] Old `#match=<id>` links redirect to `/match/<id>`.
- [ ] Remove the legacy PIN account and the `legacy/` folder after a grace period.

---

## 10. Cost at this scale (Blaze with free allowances)

| Service           | Free allowance                                     | Expected use                                   |
| ----------------- | -------------------------------------------------- | ---------------------------------------------- |
| Realtime Database | 1 GB stored, 10 GB downloaded/month                | Well under both, thanks to event-based matches |
| Hosting           | 10 GB stored, 360 MB/day transferred               | Small                                          |
| Auth              | Free for Google/Apple/anonymous                    | Free                                           |
| Cloud Functions   | 2M calls/month                                     | A few thousand                                 |
| App Check         | Free (reCAPTCHA Enterprise: 10k checks/month free) | Under the limit                                |
| EAS Build         | ~15 iOS + 15 Android builds/month (free tier)      | Enough                                         |
| Sentry            | 5k errors/month                                    | Enough                                         |
| Apple Developer   | Friend's account                                   | $0 for us                                      |
| Google Play       | $25 one-time (optional)                            | Skip at first; ship APK + web                  |

Safety net: a $1 budget alert in Google Cloud Billing. Usage is reviewed after the first big tournament.

---

## 11. Risks and mitigations

| Risk                              | Mitigation                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Migration corrupts old matches    | Dry run, replaying old matches and comparing totals, backups kept, legacy app kept runnable |
| App Store rejection               | Real native UI, privacy policy, reviewer demo code, no web-wrapper behavior                 |
| Scorer loses signal at the ground | Offline queue, sync indicator, events are idempotent (push IDs + `seq`)                     |
| Scorer code leaked                | Per-match codes, admins can rotate or revoke, events record `by`, undo/audit                |
| Bill surprise                     | Budget alert, event-based bandwidth, usage review                                           |
| Scope creep                       | Phased pull requests; legacy app stays live until cutover                                   |

---

## 12. Glossary

- **Event-sourced:** store what happened (each ball) and calculate the current state from it.
- **Security rules:** Firebase's server-side checks that decide who can read or write each path. The real security boundary.
- **App Check:** proves requests come from your genuine app, not a script.
- **EAS:** Expo Application Services, cloud builds, store submission and over-the-air updates.
- **TestFlight:** Apple's beta-testing app for iOS builds before public release.
- **PWA:** a website that can be installed to the home screen like an app.
