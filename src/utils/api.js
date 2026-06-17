// api.js — Frontend API client. All requests hit the local Express server
// (proxied by Vite in dev, same-origin in production).

async function req(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Reference
  sections: () => req('/sections'),

  // Calendar / roster
  calendar: (year, month, mefCeStart) => req(`/roster/calendar?year=${year}&month=${month}&mefCeStart=${mefCeStart}`),
  generate: (body) => req('/roster/generate', { method: 'POST', body: JSON.stringify(body) }),
  grade: (roster) => req('/roster/grade', { method: 'POST', body: JSON.stringify({ roster }) }),
  owed: (year, month) => req(`/roster/owed?year=${year}&month=${month}`),
  finalize: (body) => req('/roster/finalize', { method: 'POST', body: JSON.stringify(body) }),

  // Personnel
  personnel: () => req('/personnel'),
  setPersonnel: (personnel) => req('/personnel', { method: 'PUT', body: JSON.stringify({ personnel }) }),
  addPerson: (person) => req('/personnel', { method: 'POST', body: JSON.stringify(person) }),
  updatePerson: (id, patch) => req(`/personnel/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deletePerson: (id) => req(`/personnel/${id}`, { method: 'DELETE' }),
  importCsv: (csv, replace) => req('/personnel/import-csv', { method: 'POST', body: JSON.stringify({ csv, replace }) }),

  // History
  history: () => req('/history'),
  burden: () => req('/history/burden'),
  deleteHistory: (year, month) => req(`/history/${year}/${month}`, { method: 'DELETE' }),

  // SharePoint
  spStatus: () => req('/sharepoint/status'),
  spSync: () => req('/sharepoint/sync', { method: 'POST' }),
  spAuthUrl: () => req('/sharepoint/auth-url'),
};

// Excel export needs a binary response → handled outside req().
export async function exportRoster(roster) {
  const res = await fetch('/api/roster/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roster }),
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${roster.monthName}_${roster.year}_OOD_AOOD_Duty_Roster.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// History upload (multipart).
export async function uploadHistory(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  const res = await fetch('/api/history/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}
