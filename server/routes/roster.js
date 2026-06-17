// roster.js — Roster generation, grading, and Excel export endpoints.

import express from 'express';
import { buildCalendar } from '../../src/utils/calendar.js';
import { generateRoster } from '../../src/utils/rosterGenerator.js';
import { summarize, gradeRoster, owedLighterMonths } from '../../src/utils/fairness.js';
import { exportRosterToBuffer, rosterFilename } from '../../src/utils/excelExport.js';
import { getPersonnel, getHistory, getHolidays, upsertRoster } from '../services/store.js';
import { uploadRoster } from '../services/sharepointSync.js';

const router = express.Router();

// Calendar for a month (weekends + holidays + pool ownership).
router.get('/calendar', (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const mefCeStart = Number(req.query.mefCeStart) || 16;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  res.json(buildCalendar(year, month, getHolidays(), mefCeStart));
});

// Generate a full roster.
router.post('/generate', (req, res) => {
  const { year, month, mefCeStart = 16, fillMsb = true, aoodPool = 'MSB' } = req.body || {};
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });

  const calendar = buildCalendar(year, month, getHolidays(), mefCeStart);
  const personnel = getPersonnel();
  const burden = summarize(getHistory());
  const roster = generateRoster(calendar, personnel, burden, { mefCeStart, fillMsb, aoodPool });
  const fairness = gradeRoster(roster, burden);
  res.json({ roster, fairness });
});

// Re-grade an (edited) roster.
router.post('/grade', (req, res) => {
  const { roster } = req.body || {};
  if (!roster) return res.status(400).json({ error: 'roster required' });
  const burden = summarize(getHistory());
  res.json(gradeRoster(roster, burden));
});

// Sections "owed" lighter months for the target.
router.get('/owed', (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const burden = summarize(getHistory());
  res.json(owedLighterMonths(burden, { year, month }));
});

// Export to .xlsx (download).
router.post('/export', async (req, res) => {
  const { roster } = req.body || {};
  if (!roster) return res.status(400).json({ error: 'roster required' });
  const buffer = await exportRosterToBuffer(roster);
  const filename = rosterFilename(roster);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
});

// Save the finished roster into local history (and optionally upload to SharePoint).
router.post('/finalize', async (req, res) => {
  const { roster, uploadToSharePoint = false, toArchive = false } = req.body || {};
  if (!roster) return res.status(400).json({ error: 'roster required' });

  // Persist a section-level summary into history for future fairness runs.
  const summary = {
    month: roster.month,
    year: roster.year,
    label: roster.label,
    mefCeStart: roster.mefCeStart,
    days: roster.days.map((d) => ({
      date: d.date,
      day: d.day,
      oodSection: d.ood?.section || '',
      aoodSection: d.aood?.section || '',
      holiday: d.holiday || '',
      isWeekend: d.isWeekend,
    })),
  };
  upsertRoster(summary);

  let upload = null;
  if (uploadToSharePoint) {
    try {
      const buffer = await exportRosterToBuffer(roster);
      upload = await uploadRoster(rosterFilename(roster), Buffer.from(buffer), toArchive);
    } catch (e) {
      upload = { error: e.message };
    }
  }
  res.json({ ok: true, upload });
});

export default router;
