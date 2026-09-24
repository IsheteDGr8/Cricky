# Architecture

Cricky is one Expo app (iOS, Android, web) split into layers. Each layer has one job and may only
depend on the layers below it. ESLint enforces these rules (`no-restricted-imports` in
[`eslint.config.js`](../eslint.config.js)), so a wrong import fails CI.

```
src/app ───────► src/features ───────► src/data ───► Firebase
   │                 │    │                │
   │                 │    └──────────► src/domain ◄──┘
   └──► src/ui ◄─────┘
```

Arrows mean "may import". `src/features` arrives in Phase 4.

| Layer          | Job                                                      | May import                   |
| -------------- | -------------------------------------------------------- | ---------------------------- |
| `src/app`      | Routes and screen layout                                 | features, ui, domain         |
| `src/features` | Screen state: subscribe to data, derive with domain      | data, domain, ui             |
| `src/data`     | The only code that talks to Firebase; validates records  | domain, Firebase             |
| `src/domain`   | Cricket rules, scoring, stats, playoffs. Pure TypeScript | nothing outside `src/domain` |
| `src/ui`       | Tokens, theme, presentational components                 | React Native, Expo only      |

Why: the cricket rules are the part most likely to have bugs and the part users care most about,
so they live where they can be tested exhaustively without a phone, a browser or a database.

## Scoring is event-sourced

A match is stored as its setup plus an append-only list of events (`set_openers`, `set_bowler`,
`delivery`, `new_batter`, `end_innings`, ...). The full match state — scorecards, fall of wickets,
partnerships, result — is never stored as the source of truth; it is recomputed:

```ts
const state = replay(setup, events); // MatchState
```

- **Undo** is `replay(setup, events.slice(0, -1))`. It works through any event, including the end
  of an innings or the match, because nothing is ever overwritten.
- **Validation** happens once, in `applyEvent`. An illegal event (a bowler bowling consecutive
  overs, a delivery with no batter at the crease) throws a `ScoringError` with a machine-readable
  `code`, so the scoring screen can show a clear message.
- **Sync** is simple: scorers append events; viewers replay them. Two devices can never disagree
  about the score.

### Where things live in `src/domain/scoring`

| File            | Contains                                                                |
| --------------- | ----------------------------------------------------------------------- |
| `types.ts`      | Every event and state type                                              |
| `rules.ts`      | Small cricket-law functions (what counts as a ball, who is charged)     |
| `engine.ts`     | `createMatch`, `applyEvent`, `replay`: the only code that changes state |
| `result.ts`     | Target, balls remaining, win/tie margins                                |
| `selectors.ts`  | Read-only questions for screens (`nextAction`, available bowlers)       |
| `commentary.ts` | Text: ball badges, commentary lines, dismissal notation, over summaries |
| `overs.ts`      | Ball/over arithmetic and run rates                                      |

## Stats are derived from finished matches

When a match completes, `summarizeMatch` turns its state into a small `CompletedMatch` record
(innings totals and per-player lines). Standings, net run rate and leaderboards are pure functions
over a list of those records, so they are always consistent with the scorecards and can be
recomputed at any time. Callers choose which matches count: group-stage matches for standings,
tournament matches (not quick matches) for leaderboards.

Playoffs are a `Bracket` (fixtures whose teams come from standings positions or earlier results)
resolved against the current rankings and winners; nothing about the bracket is stored except who
won each fixture.

## Data: Firebase Realtime Database

`src/data` is the only code that imports Firebase. Screens get a `DataLayer` from
`createDataLayer()` and never see a database path.

```
/roles/{uid}               'admin' (the owner is set by hand in the console)
/tournaments/{tid}         name, status, overs, playoff format, playoff winners
/teams/{teamId}            name, tournamentId, group, captainId, players
/matches/{mid}/meta        setup: teams, squads, overs, toss, locked
/matches/{mid}/head        number of events
/matches/{mid}/events/{n}  the event log, keys "0".."head-1"
/matchSummaries/{mid}      small live score for lists (status, totals, result)
/matchResults/{mid}        CompletedMatch record for standings and leaderboards
/scorerCodes/{mid}         the match's scorer code (admins only)
/scorers/{mid}/{uid}       scorers who redeemed the code
```

- **Who can do what** is decided by [`firebase/database.rules.json`](../firebase/database.rules.json),
  not by the app. Viewers read without signing in. Admins sign in with Google or Apple and hold a
  role in `/roles`. Scorers get an anonymous session and redeem a 10-character code; the rules
  compare the code they saved with the current one, so issuing a new code or revoking it removes
  every scorer at once.
- **Events are append-only.** A scorer may only write event `head` while moving `head` to `head+1`,
  or remove the last event while moving `head` back (undo). Two scorers appending at once cannot
  both succeed; the loser gets `permission_denied` and retries on the new head.
- **Every record is validated twice**: by the rules on write, and by the zod schemas in
  `schemas.ts` on read. Records that fail are reported (`invalid`), never shown.
- **Summaries and results are derived.** The scorer's device publishes them from the replayed
  state; anyone can recompute them from the events.

| File                | Contains                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `schemas.ts`        | zod schemas for every stored record                              |
| `records.ts`        | Conversions between stored records and domain types              |
| `repositories/*.ts` | Typed reads, writes and live subscriptions, one file per area    |
| `auth.ts`           | Sign-in for admins and scorers; the current session and its role |
| `firebase.ts`       | The single Firebase connection (emulator when configured)        |
| `errors.ts`         | `DataError` with a `code` the screens can show a message for     |

Two rules files exist until the new app replaces the old one: `firebase/legacy.rules.json` is what
production runs today (used by `firebase deploy`), and `firebase/database.rules.json` is the new
schema (used by the emulator and the tests). Deploying the new rules is part of the cutover.

Emulator tests (`*.emulator.test.ts`) exercise the rules and the repositories against a local
Firebase: `npm run test:rules`. They need Java 21+.

## Conventions

- Tests sit next to the code in `__tests__/`; shared test builders live in `__fixtures__/`.
- `src/domain` must keep ≥ 90% test coverage (enforced by Jest).
- Each folder exposes its public API through `index.ts`; import from the folder, not its files.
