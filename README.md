# Discovery Review Command Center

A local-first Next.js app for reviewing an Opportunity Solution Tree, assumptions,
tests, owners, and weekly progress.

This version runs directly on your machine with local SQLite persistence.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm ci
npm run dev
```

Open the local URL printed by Next, usually `http://localhost:3000`.

## Local Data

The app stores data in a SQLite database at:

```text
data/review-command-center.sqlite
```

The database file is created automatically on first run and is ignored by git.
Set `REVIEW_DB_PATH=/absolute/path/to/file.sqlite` to use a different location.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the production build
- `npm run start`: run the production build locally
- `npm run lint`: run ESLint
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Documentation

- `docs/features.md`: user-facing functionality and behavior
- `docs/local-development.md`: local setup, data, and troubleshooting

## Project Shape

- `app/`: Next app router pages, API routes, and UI
- `lib/review-data.ts`: product data model and mutations
- `db/schema.ts`: Drizzle SQLite schema
- `db/bootstrap.ts`: local schema/bootstrap creation
- `drizzle/`: existing migration history from the exported source
