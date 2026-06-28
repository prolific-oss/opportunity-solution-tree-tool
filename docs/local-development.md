# Local Development

## Prerequisites

- Node.js `>=22.13.0`
- npm

## Install

```bash
npm ci
```

## Run Locally

```bash
npm run dev
```

Open the local URL printed by Next, usually:

```text
http://localhost:3000
```

If a previous dev server is already running, stop that process or use the URL it is already serving.

## Native SQLite Module Mismatch

The app uses `better-sqlite3`, which is a native Node module. If local development shows an error about `NODE_MODULE_VERSION` or `better_sqlite3.node`, rebuild the native module with the Node version currently running the app:

```bash
npm rebuild better-sqlite3
npm run dev
```

## Data Location

The default local database is:

```text
data/review-command-center.sqlite
```

Use a different database file with:

```bash
REVIEW_DB_PATH=/absolute/path/to/review.sqlite npm run dev
```

## Useful Commands

- `npm run dev`: start local development.
- `npm run build`: verify the production build.
- `npm run start`: run the production build locally.
- `npm run lint`: run ESLint.
- `npm run db:generate`: generate Drizzle migrations after schema changes.
