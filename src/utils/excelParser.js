// excelParser.js — Parse completed roster .xlsx files back into structured
// data for the burden-history database. Tolerant of minor format variation.

import ExcelJS from 'exceljs';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const SECTION_ALIASES = {
  COMMSTRAT: 'CMST',
  'CMST/COMMSTRAT': 'CMST',
};

export function normalizeSection(s) {
  if (!s) return '';
  const up = String(s).trim().toUpperCase();
  return SECTION_ALIASES[up] || up;
}

// Pull month + year from a filename like "May_2026_OOD_AOOD_Duty_Roster.xlsx".
export function monthYearFromName(name) {
  const lower = name.toLowerCase();
  let month = null;
  for (const [m, num] of Object.entries(MONTHS)) {
    if (lower.includes(m)) { month = num; break; }
  }
  const yearMatch = lower.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  return { month, year };
}

function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    return '';
  }
  return String(v).trim();
}

// Locate the header row by scanning for "DATE" + "OOD".
function findHeaderRow(ws) {
  let found = null;
  ws.eachRow((row, rowNumber) => {
    if (found) return;
    const vals = row.values.map((c) => String(c ?? '').toUpperCase());
    if (vals.some((v) => v.includes('DATE')) && vals.some((v) => v.includes('OOD'))) {
      found = rowNumber;
    }
  });
  return found || 2;
}

// Map header labels to column indices (flexible). AOOD checks come before
// OOD because "AOOD#".includes("OOD#") is true.
function mapColumns(ws, headerRow) {
  const row = ws.getRow(headerRow);
  const map = {};
  row.eachCell((cell, col) => {
    const t = cellText(cell).toUpperCase().replace(/\s+/g, '');
    if (t === 'DATE') map.date = col;
    else if (t === 'DAY') map.day = col;
    else if (t.includes('HOLIDAY')) map.holiday = col;
    else if (t.includes('AOOD#')) map.aoodPhone = col;
    else if (t.includes('OOD#')) map.oodPhone = col;
    else if (t === 'AOOD' && map.aood == null) map.aood = col;
    else if (t === 'OOD' && map.ood == null) map.ood = col;
    else if (t === 'SECTION') {
      if (map.oodSection == null) map.oodSection = col;
      else map.aoodSection = col;
    }
  });
  return map;
}

// Safe cell read: returns '' when the column was not found in the header.
function cellAt(row, col) {
  if (!col) return '';
  return cellText(row.getCell(col));
}

export async function parseRosterBuffer(buffer, filename = '') {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const headerRow = findHeaderRow(ws);
  const col = mapColumns(ws, headerRow);
  const { month, year } = monthYearFromName(filename);

  const days = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const dateRaw = cellAt(row, col.date || 1);
    const date = parseInt(dateRaw, 10);
    const oodSection = normalizeSection(cellAt(row, col.oodSection));
    // Stop at supernumerary / total / blank section rows.
    if (/SUPERNUMERARY|TOTAL/i.test(dateRaw) || /SUPERNUMERARY/i.test(oodSection)) continue;
    if (!Number.isFinite(date)) continue;

    days.push({
      date,
      day: cellAt(row, col.day),
      ood: cellAt(row, col.ood),
      oodSection,
      oodPhone: cellAt(row, col.oodPhone),
      aood: cellAt(row, col.aood),
      aoodSection: normalizeSection(cellAt(row, col.aoodSection)),
      aoodPhone: cellAt(row, col.aoodPhone),
      holiday: cellAt(row, col.holiday),
    });
  }

  return {
    filename,
    month,
    year,
    label: month && year ? `${Object.keys(MONTHS)[month - 1]} ${year}` : filename,
    days,
  };
}
