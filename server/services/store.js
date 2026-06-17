// store.js — Local JSON cache persistence. Everything the app needs to run
// offline lives here and survives between sessions.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const SRC_DATA = path.join(__dirname, '..', '..', 'src', 'data');

for (const dir of [DATA_DIR, CACHE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const FILES = {
  personnel: path.join(DATA_DIR, 'personnel.json'),
  history: path.join(DATA_DIR, 'history.json'),
  syncState: path.join(DATA_DIR, 'syncState.json'),
};

// ── Personnel ──────────────────────────────────────────────────────────
export function getPersonnel() {
  const data = readJson(FILES.personnel, null);
  if (data && Array.isArray(data.personnel)) return data.personnel;
  // Seed from sample on first run.
  const sample = readJson(path.join(SRC_DATA, 'samplePersonnel.json'), { personnel: [] });
  writeJson(FILES.personnel, { personnel: sample.personnel });
  return sample.personnel;
}

export function setPersonnel(personnel) {
  writeJson(FILES.personnel, { personnel });
  return personnel;
}

// ── History (list of roster summaries) ─────────────────────────────────
export function getHistory() {
  const data = readJson(FILES.history, null);
  if (data && Array.isArray(data.rosters)) return data.rosters;
  // Seed from bundled 5-month history on first run.
  const seed = readJson(path.join(SRC_DATA, 'seedHistory.json'), { rosters: [] });
  writeJson(FILES.history, { rosters: seed.rosters });
  return seed.rosters;
}

export function setHistory(rosters) {
  writeJson(FILES.history, { rosters });
  return rosters;
}

// Upsert a roster (dedupe by year+month).
export function upsertRoster(roster) {
  const rosters = getHistory();
  const i = rosters.findIndex((r) => r.year === roster.year && r.month === roster.month);
  if (i >= 0) rosters[i] = roster;
  else rosters.push(roster);
  setHistory(rosters);
  return rosters;
}

// ── Sync state ─────────────────────────────────────────────────────────
export function getSyncState() {
  return readJson(FILES.syncState, { lastSync: null, files: {}, rostersLoaded: 0, personnelLoaded: 0 });
}

export function setSyncState(state) {
  writeJson(FILES.syncState, state);
  return state;
}

// ── Holidays / sections (read-only bundled data) ───────────────────────
export function getHolidays() {
  return readJson(path.join(SRC_DATA, 'holidays.json'), { holidays: [] }).holidays;
}

export function getSections() {
  return readJson(path.join(SRC_DATA, 'sections.json'), { msb: [], mefce: [] });
}

export { CACHE_DIR };
