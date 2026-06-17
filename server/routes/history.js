// history.js — Historical roster data + burden analysis endpoints.

import express from 'express';
import multer from 'multer';
import { parseRosterBuffer } from '../../src/utils/excelParser.js';
import { summarize, owedLighterMonths } from '../../src/utils/fairness.js';
import { getHistory, setHistory, upsertRoster } from '../services/store.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// History + computed burden summary.
router.get('/', (req, res) => {
  const rosters = getHistory();
  const burden = summarize(rosters);
  res.json({ rosters, burden });
});

router.get('/burden', (req, res) => {
  res.json(summarize(getHistory()));
});

router.get('/owed', (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  res.json(owedLighterMonths(summarize(getHistory()), { year, month }));
});

// Upload one or more completed roster .xlsx files (manual fallback to SharePoint).
router.post('/upload', upload.array('files'), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'no files uploaded' });
  const results = [];
  for (const f of req.files) {
    try {
      const parsed = await parseRosterBuffer(f.buffer, f.originalname);
      if (!parsed.month || !parsed.year) {
        results.push({ file: f.originalname, error: 'could not determine month/year from filename' });
        continue;
      }
      const summary = {
        month: parsed.month,
        year: parsed.year,
        label: parsed.label,
        days: parsed.days.map((d) => ({
          date: d.date,
          day: d.day,
          oodSection: d.oodSection,
          aoodSection: d.aoodSection,
          holiday: d.holiday,
        })),
      };
      upsertRoster(summary);
      results.push({ file: f.originalname, month: parsed.month, year: parsed.year, days: parsed.days.length });
    } catch (e) {
      results.push({ file: f.originalname, error: e.message });
    }
  }
  res.json({ results, burden: summarize(getHistory()) });
});

router.delete('/:year/:month', (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const rosters = getHistory().filter((r) => !(r.year === year && r.month === month));
  setHistory(rosters);
  res.json({ ok: true, rosters });
});

export default router;
