import { readFile, rename, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { buildStats } from './stats.mjs';
const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/releases.json', root), 'utf8'));
const temp = fileURLToPath(new URL('data/versionbench.sqlite.tmp', root));
await rm(temp, { force: true });
const db = new DatabaseSync(temp);
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE families (id TEXT PRIMARY KEY,name TEXT NOT NULL,provider TEXT NOT NULL,color TEXT NOT NULL,core INTEGER NOT NULL CHECK(core IN(0,1)),kind TEXT NOT NULL CHECK(kind IN('model','software')),scope TEXT);
CREATE TABLE sources (id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL,publisher TEXT NOT NULL,published_date TEXT,checked_at TEXT NOT NULL);
CREATE TABLE releases (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),name TEXT NOT NULL,version TEXT NOT NULL,score REAL NOT NULL CHECK(score>=0),release_date TEXT NOT NULL,status TEXT NOT NULL,event_type TEXT NOT NULL,date_basis TEXT NOT NULL,source_id TEXT NOT NULL REFERENCES sources(id),date_source_id TEXT REFERENCES sources(id),artificial_analysis_url TEXT,weights_status TEXT NOT NULL CHECK(weights_status IN('open','not-published','unverified','not-applicable')),weights_checked_at TEXT NOT NULL,hugging_face_url TEXT,weights_source_url TEXT NOT NULL,weights_note TEXT,note TEXT,mapping TEXT);
CREATE TABLE family_stats (family_id TEXT PRIMARY KEY REFERENCES families(id),snapshot TEXT NOT NULL,release_count INTEGER NOT NULL,version_count INTEGER NOT NULL,highest_score REAL NOT NULL,first_release_at_highest_version TEXT NOT NULL REFERENCES releases(id),latest_release TEXT NOT NULL REFERENCES releases(id),current_rank INTEGER NOT NULL,days_at_number_one INTEGER NOT NULL,average_rank REAL NOT NULL,tracked_days INTEGER NOT NULL,release_rate_per_year REAL NOT NULL);
CREATE TABLE family_rank_history (family_id TEXT NOT NULL REFERENCES family_stats(family_id),rank_date TEXT NOT NULL,rank INTEGER NOT NULL CHECK(rank>=1),PRIMARY KEY(family_id,rank_date));
CREATE TABLE family_version_history (family_id TEXT NOT NULL REFERENCES families(id),version_date TEXT NOT NULL,version TEXT NOT NULL,score REAL NOT NULL,release_id TEXT NOT NULL REFERENCES releases(id),PRIMARY KEY(family_id,version_date));
CREATE INDEX releases_family_date ON releases(family_id,release_date);
CREATE VIEW release_sources AS SELECT r.*,s.title AS source_title,s.url AS source_url,s.publisher,ds.title AS date_source_title,ds.url AS date_source_url,ds.publisher AS date_source_publisher FROM releases r JOIN sources s ON r.source_id=s.id LEFT JOIN sources ds ON r.date_source_id=ds.id;
BEGIN;`);
db.prepare('INSERT INTO metadata VALUES (?,?)').run('updated', data.updated);
const family = db.prepare('INSERT INTO families VALUES (?,?,?,?,?,?,?)');
for (const f of data.families)
  family.run(f.id, f.name, f.provider, f.color, Number(f.core), f.kind, f.scope ?? null);
const source = db.prepare('INSERT INTO sources VALUES (?,?,?,?,?,?)');
for (const s of data.sources)
  source.run(s.id, s.title, s.url, s.publisher, s.date ?? null, s.checkedAt);
const release = db.prepare('INSERT INTO releases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for (const r of data.releases)
  release.run(
    r.id,
    r.family,
    r.name,
    r.version,
    r.score,
    r.date,
    r.status,
    r.eventType,
    r.dateBasis ?? 'publisher',
    r.sourceId,
    r.dateSourceId ?? null,
    r.artificialAnalysisUrl ?? null,
    r.weightsStatus,
    r.weightsCheckedAt,
    r.huggingFaceUrl ?? null,
    r.weightsSourceUrl,
    r.weightsNote ?? null,
    r.note ?? null,
    r.mapping ?? null,
  );
const familyStats = db.prepare('INSERT INTO family_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
const rankHistory = db.prepare('INSERT INTO family_rank_history VALUES (?,?,?)');
const summaries = buildStats(data);
for (const f of summaries.families) {
  familyStats.run(
    f.id,
    data.updated,
    f.releaseCount,
    f.versionCount,
    f.highestScore,
    f.firstReleaseAtHighestVersion.id,
    f.latestRelease.id,
    f.currentRank,
    f.daysAtNumberOne,
    f.averageRank,
    f.trackedDays,
    f.releaseRatePerYear,
  );
  for (const entry of f.rankHistory) rankHistory.run(f.id, entry.date, entry.rank);
}
const versions = db.prepare('INSERT INTO family_version_history VALUES (?,?,?,?,?)');
for (const f of [...summaries.families, ...summaries.softwareControls])
  for (const entry of f.versionHistory)
    versions.run(f.id, entry.date, entry.version, entry.score, entry.releaseId);
db.exec('COMMIT;');
const integrity = db.prepare('PRAGMA integrity_check').get();
if (integrity.integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
if (db.prepare('PRAGMA foreign_key_check').all().length)
  throw new Error('SQLite foreign key check failed');
db.close();
const target = fileURLToPath(new URL('data/versionbench.sqlite', root));
await rename(temp, target);
console.log(
  `Exported ${target}: ${data.releases.length} releases, ${data.sources.length} sources.`,
);
