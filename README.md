# Cricky

Live cricket scoring for tournaments and quick matches, on iPhone, Android and the web.

> **Status:** v2 rebuild in progress (see [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md)).
> The current live site at https://cricky-cricket-analysis.web.app is still the v1 app in [`legacy/`](legacy/).

## Tech stack

- [Expo](https://expo.dev) SDK 57 (React Native + React Native Web) with [Expo Router](https://docs.expo.dev/router/introduction/)
- TypeScript (strict)
- Firebase Realtime Database, Auth, Hosting
- Jest + React Native Testing Library, ESLint, Prettier
- GitHub Actions CI, Expo EAS for app builds

## Getting started

Requirements: Node.js 24+ and npm.

```bash
npm install
npm run web        # open in the browser
npm start          # dev server; scan the QR code with the Expo Go app on your phone
```

## Scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm start`         | Start the Expo dev server                            |
| `npm run web`       | Start and open the web app                           |
| `npm run typecheck` | TypeScript type check                                |
| `npm run lint`      | ESLint (includes Prettier formatting rules)          |
| `npm run format`    | Format all files with Prettier                       |
| `npm test`          | Run unit tests                                       |
| `npm run test:ci`   | Tests with coverage (scoring engine must stay ≥ 90%) |
| `npm run build:web` | Export the static web build to `dist/`               |
| `npm run check`     | Everything CI runs, in one command                   |

A pre-commit hook (Husky + lint-staged) lints and formats changed files automatically.

## Project structure

```
src/
  app/         Screens and navigation (Expo Router: every file is a route)
  domain/      Pure scoring and stats logic: no React, no Firebase
  ui/          Design system: tokens, theme, shared components
firebase/      Realtime Database security rules
legacy/        v1 web app (still what's live until cutover)
docs/          Plans and architecture notes
```

Dependency rule: `app/` may use `domain/` and `ui/`; `domain/` imports nothing app-specific.
ESLint enforces it. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the layers and how
event-sourced scoring works.

## Deploying the v1 site and rules

The legacy site and database rules still deploy with the Firebase CLI:

```bash
firebase deploy --only hosting    # serves legacy/
firebase deploy --only database   # firebase/database.rules.json
```

## Contributing

1. Branch from `main` (`feature/<name>`).
2. Keep pull requests small; CI must pass.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
