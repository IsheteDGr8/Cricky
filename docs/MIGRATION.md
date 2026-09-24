# Migrating v1 data

The v1 app stored each match as running totals plus a commentary log. The new app stores an event
log (see [`ARCHITECTURE.md`](ARCHITECTURE.md)). The migration in
[`scripts/migrate-legacy/`](../scripts/migrate-legacy/) rebuilds every match's events from its
commentary, replays them through the scoring engine, and checks the replay against the totals v1
stored.

## Dry run

```sh
npm run migrate:dry-run -- backups/rtdb-2026-09-23-1147.json
```

It reads a database export and writes `backups/<name>.migrated.json`. Nothing is sent to Firebase.
Each match is reported as:

| Outcome | Meaning                                                                                    |
| ------- | ------------------------------------------------------------------------------------------ |
| `OK`    | Every innings total, batting line, bowling line, result and Player of the Match matches v1 |
| `DIFF`  | Migrated, but some numbers differ; each difference is listed                               |
| `SKIP`  | Not migrated, with the reason                                                              |

Lines marked `(adjusted)` are places where v1's data broke a rule of cricket and had to be
interpreted. The script exits with 1 unless every match is `OK`, so each run gets a human review.

## How v1 data is read

| v1 data                                    | Used for                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| Commentary "Bowler to Batter. ..." + label | Who bowled, who faced, and what happened on each ball                         |
| Innings `outPlayers`                       | Who was out on each wicket (v1's "Bowled!" text always named the striker)     |
| Innings `playerStats[].batOrder`           | Who came in after each wicket                                                 |
| Team players' push-id timestamps           | The squad at the start of the match; later players become `add_player` events |
| Tournament `playoffs` + group standings    | Which playoff match is which bracket fixture, and its winner                  |

Adjustments the migration makes, always listed in the report:

- **Non-striker "bowled" or "caught"**: impossible in cricket; recorded as run out, so the bowler
  loses that wicket.
- **A batter swapped for another without a wicket**: recorded as retired hurt.
- **Players renamed since the match**: matched to the closest current name (at most 3 letters
  different, and only if unambiguous).
- **Wicket margins**: early v1 used a fixed 8-wicket limit; the new rules use squad size − 1, so
  some margins read differently (e.g. "won by 5 wickets" becomes "won by 7 wickets").

Not migrated: v1's cached team and career stats (the new app derives them from results), match
PINs (replaced by scorer codes), and matches whose teams were deleted.

## Result of the dry run on the 2026-09-23 backup

11 matches exact, 1 differing by the single bowler wicket explained above, 2 skipped (test matches
whose teams no longer exist). Standings, playoff bracket and champion match v1.

## At cutover (Phase 7)

1. Export the live database again and rerun the dry run on it; review the report.
2. Deploy `firebase/database.rules.json`.
3. Import the migrated file: `firebase database:set / backups/<name>.migrated.json`.
4. Set your own role in the console: `/roles/<your uid>` = `"owner"`.
