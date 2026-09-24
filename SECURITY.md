# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub private vulnerability reporting](https://github.com/IsheteDGr8/Cricky/security/advisories/new).
You should get a reply within 7 days. Once a fix is released we will credit you in the advisory
unless you prefer otherwise.

In scope: the Cricky apps, the website at https://cricky-cricket-analysis.web.app, the Firebase
security rules in this repo, and the CI/CD pipeline. Out of scope: denial-of-service testing and
anything that affects real users' data. Test against the Firebase emulator (`npm run emulators`)
instead of the live project.

## Supported versions

Only the latest release on `main` receives fixes.

## How Cricky is secured

- **Server-side rules are the security boundary.** The Firebase web config in the app is public by
  design. Every read and write is checked by the database rules in
  [`firebase/database.rules.json`](firebase/database.rules.json), and those rules are tested.
- **Least privilege:** viewers are read-only and need no account; scorers can only add events to
  the matches they were given a code for; only admins can manage tournaments.
- **Automated checks on every pull request:** static analysis (CodeQL), secret scanning
  (gitleaks), dependency review, `npm audit`, npm registry signature verification, plus
  type-checking, linting and tests. OpenSSF Scorecard grades the repo weekly.
- **Supply chain:** exact lockfile installs (`npm ci`), GitHub Actions pinned to commit SHAs,
  Dependabot for updates, and minimal workflow permissions.

The full threat model is in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Incident response

If a secret leaks, data is tampered with, or a scorer code is abused:

1. **Contain.** Revoke the affected scorer code or disable the account in Firebase Auth. If writes
   are being abused, deploy a read-only ruleset (`".write": false` everywhere).
2. **Rotate.** Replace any leaked credential. Deleting the commit is not enough, because git
   history and forks keep it.
3. **Recover.** Every event records who wrote it (`by`) and when (`at`). Remove bad events, or
   restore from the latest backup in `backups/` (kept locally, never committed).
4. **Review.** Write down what happened, then add a rules test or CI check so it can't recur.
