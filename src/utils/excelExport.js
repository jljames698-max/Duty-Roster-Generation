// excelExport.js — Generate a formatted .xlsx matching the established roster
// template. Runs server-side (Node) via exceljs.

import ExcelJS from 'exceljs';

const HEADERS = ['DATE', 'DAY', 'OOD', 'SECTION', 'OOD#', 'AOOD', 'SECTION', 'AOOD#', 'Holiday'];
const COL_WIDTHS = [6, 12, 32, 10, 16, 32, 10, 16, 18];

const FILL_WEEKEND = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const FILL_HOLIDAY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
const FILL_SUPER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

const THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function styleRow(row, { font, fill } = {}) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = font || { name: 'Calibri', size: 8, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
    if (fill) cell.fill = fill;
  });
}

export async function buildWorkbook(roster) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I MSB Duty Roster Generator';
  wb.created = new Date();
  const ws = wb.addWorksheet(`${roster.monthName} ${roster.year}`, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = COL_WIDTHS.map((w) => ({ width: w }));

  // Row 1: Title (merged across all 9 columns).
  const title = `MEF & MSB Duty Roster for ${roster.monthName} ${roster.year}. P.O.C for NO SHOWS is the HQ Co 1stLt Joseph, James`;
  ws.mergeCells(1, 1, 1, HEADERS.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 11, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  titleCell.border = THIN_BORDER;
  ws.getRow(1).height = 30;

  // Row 2: Headers.
  const headerRow = ws.getRow(2);
  HEADERS.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleRow(headerRow, { font: { name: 'Calibri', size: 10, bold: true } });

  // Data rows.
  let r = 3;
  for (const d of roster.days) {
    const row = ws.getRow(r);
    row.getCell(1).value = d.date;
    row.getCell(2).value = d.day;
    row.getCell(3).value = d.ood?.name || '';
    row.getCell(4).value = d.ood?.section || '';
    row.getCell(5).value = d.ood?.phone || '';
    row.getCell(6).value = d.aood?.name || '';
    row.getCell(7).value = d.aood?.section || '';
    row.getCell(8).value = d.aood?.phone || '';
    row.getCell(9).value = d.holiday || '';

    let fill;
    if (d.isHoliday) fill = FILL_HOLIDAY;       // amber for holiday/96 rows
    else if (d.isWeekend) fill = FILL_WEEKEND;  // yellow for weekends
    styleRow(row, { fill });
    r += 1;
  }

  // Supernumerary rows (black fill, white text).
  const superFont = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
  for (const s of roster.supernumerary || []) {
    const row = ws.getRow(r);
    row.getCell(1).value = s.element;
    row.getCell(2).value = 'SUPERNUMERARY';
    row.getCell(3).value = s.name || '';
    row.getCell(4).value = s.section || '';
    row.getCell(5).value = s.phone || '';
    styleRow(row, { font: superFont, fill: FILL_SUPER });
    r += 1;
  }

  // Total count row.
  const totalRow = ws.getRow(r);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(2).value = `${roster.days.length} days`;
  styleRow(totalRow, { font: { name: 'Calibri', size: 8, bold: true } });

  return wb;
}

export async function exportRosterToBuffer(roster) {
  const wb = await buildWorkbook(roster);
  return wb.xlsx.writeBuffer();
}

export function rosterFilename(roster) {
  return `${roster.monthName}_${roster.year}_OOD_AOOD_Duty_Roster.xlsx`;
}
