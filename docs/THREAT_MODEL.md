# Threat model

What we protect, who might attack it, and what stops them. Review this whenever a new kind of
data, role or third-party service is added.

## Assets

| Asset                                  | Why it matters                                |
| -------------------------------------- | --------------------------------------------- |
| Match events and results               | The product. Tampering ruins trust in scores. |
| Tournament structure (teams, fixtures) | Admin-only; vandalism would disrupt events.   |
| Scorer codes                           | Grant write access to a match.                |
| Admin accounts                         | Full control of tournaments.                  |
| Firebase bill                          | Abuse could exceed free allowances.           |
| Source code and CI pipeline            | A compromised pipeline could ship malware.    |

The app stores no sensitive personal data: player names only, no emails of viewers or players.

## Actors

- **Viewer:** anonymous, read-only. The vast majority of users.
- **Scorer:** anonymous session plus a per-match code.
- **Admin:** signed in with Google or Apple; role granted by the owner.
- **Attacker:** anyone on the internet with the public source code and the public Firebase config.

## Threats (STRIDE) and mitigations

| Threat                                                      | Mitigation                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Spoofing:** create an account and act as an admin         | Roles live in `/roles/{uid}`, writable only by the owner. Creating an account grants nothing. Sign-up is disabled for email/password.     |
| **Spoofing:** guess a scorer code                           | Random 10-character codes (~10¹⁵ combinations) from a secure RNG, per match, rotatable and revocable; the rules reject any other value.   |
| **Tampering:** edit or delete past balls                    | Events are append-only. Only the last event can be removed (undo), and only by that match's scorers. Completed matches lock.              |
| **Tampering:** write malformed data to crash viewers        | `.validate` rules on every field; zod validation when reading; the engine rejects illegal event sequences.                                |
| **Repudiation:** "I didn't score that"                      | Every event stores `by` (uid) and `at` (server timestamp).                                                                                |
| **Information disclosure:** read scorer codes or roles      | `scorerCodes` readable only by admins; each `roles` entry readable only by that user and the owner.                                       |
| **Denial of service / bill:** scripted mass reads or writes | App Check (wired; enforce after cutover), small event-based payloads, $1 budget alert, rules cap string lengths and list sizes.           |
| **Elevation of privilege:** scorer edits another match      | Write rules check `/scorers/{matchId}/{uid}` for that specific match.                                                                     |
| **Supply chain:** malicious npm package or GitHub Action    | Lockfile installs, `npm audit signatures`, dependency review, Dependabot, actions pinned to commit SHAs, least-privilege workflow tokens. |
| **Leaked secret in git**                                    | gitleaks on every push and PR, GitHub push protection, no service-account keys in the repo.                                               |

## Known residual risks

- **Legacy app (until cutover):** the v1 site signs in with a 4-digit PIN, and the password format
  is visible in the public source. Writes are restricted to that single admin account, and Firebase
  Auth throttles repeated failed sign-ins, but a 4-digit PIN can still be guessed with enough time.
  It is retired at cutover (Phase 7).
- **Scorer codes are stored as plain text** under `scorerCodes`, readable only by admins. The
  rules compare codes directly, so hashing would need a server (Cloud Functions), and
  Realtime Database rules can't rate-limit failed guesses. At ~10¹⁵ combinations per match,
  guessing isn't practical; App Check (Phase 5) further limits scripted attempts.
- **Moderate npm advisories** in Expo's build tooling (not shipped to users). CI blocks high and
  critical; Dependabot tracks the rest.
