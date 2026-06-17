// manpowerParser.js — Parse manpower roster .xlsx into the personnel pool.
// Tolerant of column-header variation; flags records missing required fields.

import ExcelJS from 'exceljs';
import { normalizeSection } from '../../src/utils/excelParser.js';

const OOD_RANKS = ['Capt', '1stLt', '2ndLt', 'CWO2', 'CWO3', 'CWO4', 'CWO5', 'WO', 'GySgt', 'SSgt'];
const AOOD_RANKS = ['Sgt', 'Cpl'];

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

function findHeader(ws) {
  let header = null;
  ws.eachRow((row, n) => {
    if (header) return;
    const vals = row.values.map((c) => String(c ?? '').toLowerCase());
    if (vals.some((v) => v.includes('name')) && vals.some((v) => /rank|section|phone/.test(v))) {
      header = n;
    }
  });
  return header || 1;
}

function mapCols(ws, headerRow) {
  const map = {};
  ws.getRow(headerRow).eachCell((cell, col) => {
    const t = cellText(cell).toLowerCase();
    if (/name/.test(t) && map.name == null) map.name = col;
    else if (/rank|grade/.test(t)) map.rank = col;
    else if (/section|directorate|unit|shop|g-?\d|company/.test(t) && map.section == null) map.section = col;
    else if (/phone|cell|contact|number/.test(t)) map.phone = col;
    else if (/role|duty|ood|aood|position/.test(t)) map.role = col;
    else if (/status|chit|remarks|limited|legal/.test(t)) map.status = col;
  });
  return map;
}

function inferRole(rank, explicit) {
  if (explicit) {
    const e = explicit.toUpperCase();
    if (e.includes('AOOD') || e.includes('DNCO')) return 'AOOD';
    if (e.includes('OOD')) return 'OOD';
  }
  if (AOOD_RANKS.includes(rank)) return 'AOOD';
  if (OOD_RANKS.includes(rank)) return 'OOD';
  return '';
}

export async function parseManpowerBuffer(buffer, pool = 'MSB', filename = '') {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const headerRow = findHeader(ws);
  const col = mapCols(ws, headerRow);

  const personnel = [];
  const issues = [];
  let idx = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(col.name));
    if (!name) continue;
    const rank = cellText(row.getCell(col.rank));
    const section = normalizeSection(cellText(row.getCell(col.section)));
    const phone = cellText(row.getCell(col.phone));
    const roleRaw = cellText(row.getCell(col.role));
    const status = cellText(row.getCell(col.status));
    const role = inferRole(rank, roleRaw);

    const id = `${pool}-${section || 'UNK'}-${idx++}`.toLowerCase();
    const person = { id, name, rank, section, phone, role, pool, status, source: filename };
    personnel.push(person);

    const missing = [];
    if (!rank) missing.push('rank');
    if (!section) missing.push('section');
    if (!phone) missing.push('phone');
    if (!role) missing.push('role/rank not OOD/AOOD eligible');
    if (missing.length) issues.push({ name, missing });
  }

  return { pool, filename, personnel, issues };
}
