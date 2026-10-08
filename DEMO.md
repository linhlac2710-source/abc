# Local Data Guide

## Data Behavior

This workspace contains no seeded demo records or login accounts. `server.ts` persists API collections in PostgreSQL through `DATABASE_URL`.

Provision real user accounts before testing authenticated workflows. The API creates the empty JSONB state table at startup and persists changes transactionally.

## Start the UI

Run `npm install` and `npm run dev`, then open the local URL shown by the server.

## Empty States

Lists, analytics, risk results, and learning paths remain empty until real records are created. Failed API requests are shown as errors rather than filled with sample content.
