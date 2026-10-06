// Fail before writing artifacts when the runtime cannot produce the SQLite export.
await import('node:sqlite');
await import('./build.mjs');
await import('./export-db.mjs');
await import('./check.mjs');
