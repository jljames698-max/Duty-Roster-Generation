// sharepointSync.js — Orchestrates a sync: scan Archive (rosters) + Working
// (manpower), diff against local cache, download new/updated, parse, and
// rebuild the burden history + personnel pools. Falls back cleanly if
// SharePoint is unconfigured or unreachable.

import { spConfig, isConfigured, getAccessToken } from './sharepointAuth.js';
import { listFiles, downloadFile, uploadFile } from './sharepointClient.js';
import { parseRosterBuffer } from '../../src/utils/excelParser.js';
import { parseManpowerBuffer } from './manpowerParser.js';
import { getSyncState, setSyncState, setHistory, getHistory, setPersonnel } from './store.js';

// Report the current connection status without forcing auth.
export async function status() {
  const cfg = isConfigured();
  let connected = false;
  if (cfg) {
    try {
      const token = await getAccessToken();
      connected = !!token;
    } catch {
      connected = false;
    }
  }
  const state = getSyncState();
  return {
    configured: cfg,
    connected,
    state: connected ? 'connected' : cfg ? 'auth_required' : 'offline',
    lastSync: state.lastSync,
    rostersLoaded: state.rostersLoaded || 0,
    personnelLoaded: state.personnelLoaded || 0,
    config: { tenant: spConfig().tenant, site: spConfig().site },
  };
}

// Full sync. Throws if SharePoint is unreachable so the route can report a
// 🔴 status and the user can fall back to manual upload.
export async function runSync() {
  if (!isConfigured()) {
    throw new Error('SharePoint is not configured. Set SHAREPOINT_CLIENT_ID and SHAREPOINT_TENANT_ID in .env, or use manual upload.');
  }
  const token = await getAccessToken();
  if (!token) {
    throw new Error('SharePoint authentication required. Connect via the auth flow first.');
  }

  const cfg = spConfig();
  const prevState = getSyncState();
  const fileState = { ...prevState.files };

  // ── Archive rosters → burden history ──────────────────────────────────
  const archiveFiles = await listFiles(cfg.archivePath, '.xlsx');
  const rosters = [];
  for (const f of archiveFiles) {
    const cached = fileState[f.id];
    let parsed;
    if (cached && cached.lastModified === f.lastModified && cached.roster) {
      parsed = cached.roster;
    } else {
      const buf = await downloadFile(f.id);
      const r = await parseRosterBuffer(buf, f.name);
      parsed = { month: r.month, year: r.year, label: r.label, days: r.days };
    }
    if (parsed.month && parsed.year) rosters.push(parsed);
    fileState[f.id] = { name: f.name, lastModified: f.lastModified, roster: parsed };
  }
  if (rosters.length) setHistory(rosters);

  // ── Working manpower rosters → personnel pool ────────────────────────
  const workingFiles = await listFiles(cfg.workingPath, '.xlsx');
  const personnel = [];
  let manpowerNewest = null;
  for (const f of workingFiles) {
    if (!/manpower|stander|personnel/i.test(f.name)) continue;
    manpowerNewest = !manpowerNewest || f.lastModified > manpowerNewest ? f.lastModified : manpowerNewest;
    const pool = /mef|ce|g[1-8]|directorate/i.test(f.name) ? 'MEF_CE' : 'MSB';
    const buf = await downloadFile(f.id);
    const { personnel: ppl } = await parseManpowerBuffer(buf, pool, f.name);
    personnel.push(...ppl);
  }
  if (personnel.length) setPersonnel(personnel);

  const newState = {
    lastSync: new Date().toISOString(),
    files: fileState,
    rostersLoaded: rosters.length || getHistory().length,
    personnelLoaded: personnel.length,
    manpowerLastModified: manpowerNewest,
    archiveFileCount: archiveFiles.length,
  };
  setSyncState(newState);
  return { ...newState, rosters: rosters.length, personnel: personnel.length };
}

// Upload a finished roster .xlsx back to the Working folder.
export async function uploadRoster(filename, buffer, toArchive = false) {
  if (!isConfigured()) throw new Error('SharePoint not configured');
  const cfg = spConfig();
  const folder = toArchive ? cfg.archivePath : cfg.workingPath;
  return uploadFile(folder, filename, buffer);
}
