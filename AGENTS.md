# Working on Interval

The production frontend is one standalone `index.html`. Keep it usable without a
build step. Optional sync lives in `backend/convex/`; client and backend merge
implementations must agree. Attempt IDs and deletion tombstones preserve history.

## Setup and commands

Use Node 24 (`nvm use`), then `npm ci && npm run setup` in every fresh checkout.
On minimal Linux hosts, install browser OS dependencies with
`npx playwright install --with-deps chromium`.

- `npm run doctor`: check Node, backend install, and Chromium binary availability.
  This does not establish browser launch or backend connectivity; run verification.
- `npm run dev`: foreground localhost server on an OS-assigned port; prints the
  worktree, URL, and health endpoint. Ctrl-C stops that server only. `PORT=8000`
  selects a stable port when needed. `/__health` identifies the owning checkout.
- `npm run check`: merge/rotation regression checks and backend TypeScript.
- `npm run test:e2e`: desktop and mobile Chromium smoke tests.
- `npm run verify`: all of the above checks, also used in CI.
- `npm run test:report`: open the browser report. Failure traces and screenshots
  live in `test-results/`; console/request logs are attached to the report.
- `npm run worktree -- feature/name ../interval-name`: create a branch/worktree
  from HEAD and install its dependencies. It includes committed files only.
  Run `npm run dev` inside it. Stop its server before `git worktree remove`;
  never force-remove a worktree containing someone else's work.

## Isolation and configuration

The development server serves only the app and health endpoint. It replaces sync
and Google configuration in memory, never on disk. Sync and OAuth default to off.
Set `INTERVAL_SYNC_URL` to a disposable backend's full `/sync` URL to enable sync;
set `INTERVAL_GOOGLE_CLIENT_ID` separately for real recovery QA. No production
credentials or backend deployment are required for the default verification loop.
Do not copy another worktree's backend deployment settings or browser state.

A different port gives a different localStorage origin. For manual sessions that
must persist across restarts, use a unique stable PORT per worktree. Browser tests
use fresh contexts and OS-assigned ports; no existing preview server is reused.

Real Google recovery and rotation require the exact frontend origin in the
backend's RECOVER_ORIGINS (and Google's configured origins for sign-in).
The dev server prints a 127.0.0.1 URL, which differs from localhost. Current backend
origins support `http://localhost:8000` and `http://localhost:8642`; use a matching
hostname and port or configure your disposable backend. This setup does not
provision a Convex backend or configure OAuth automatically.

## Verification and debugging

Run `npm run verify` for frontend behavior, sync, or tooling changes. For docs-only
changes, check links/commands and `git diff --check`. Add tests for changed outcomes,
not source formatting. Use the app's existing data attributes as stable selectors.
Read failure traces before retrying; do not hide failures behind retries or sleeps.

The browser suite covers persistence, deletion, preferences, layout overflow, and
sync convergence after offline edits. The sync transport is intercepted and uses
client merge logic: it does NOT verify real Convex HTTP, CORS, validators,
transactions, rotation UI, or Google sign-in. Existing rotation checks also use a
mock database. Report these boundaries when changing related behavior.

Tests block external services, fix dates where relevant, and attach browser logs.
Use synthetic histories and disposable pairing keys: traces can include request
bodies and local state. Never include a real pairing link or OAuth token in debug
artifacts. Use `npx playwright test --project=desktop --grep 'test name'` for a
focused reproduction, then run the full gate after the fix.
