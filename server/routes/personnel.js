// personnel.js — Personnel pool CRUD + CSV import.

import express from 'express';
import { getPersonnel, setPersonnel } from '../services/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ personnel: getPersonnel() });
});

// Replace the entire pool.
router.put('/', (req, res) => {
  const { personnel } = req.body || {};
  if (!Array.isArray(personnel)) return res.status(400).json({ error: 'personnel array required' });
  res.json({ personnel: setPersonnel(personnel) });
});

// Add one.
router.post('/', (req, res) => {
  const person = req.body || {};
  if (!person.name) return res.status(400).json({ error: 'name required' });
  const personnel = getPersonnel();
  person.id = person.id || `${person.section || 'UNK'}-${Date.now()}`.toLowerCase();
  personnel.push(person);
  setPersonnel(personnel);
  res.json({ person });
});

// Update one.
router.patch('/:id', (req, res) => {
  const personnel = getPersonnel();
  const i = personnel.findIndex((p) => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  personnel[i] = { ...personnel[i], ...req.body, id: personnel[i].id };
  setPersonnel(personnel);
  res.json({ person: personnel[i] });
});

router.delete('/:id', (req, res) => {
  const personnel = getPersonnel().filter((p) => p.id !== req.params.id);
  setPersonnel(personnel);
  res.json({ ok: true });
});

// CSV import. Expected headers (flexible order):
// Name,Rank,Section,Phone,Role,Pool,Status
router.post('/import-csv', (req, res) => {
  const { csv, replace = false } = req.body || {};
  if (!csv) return res.status(400).json({ error: 'csv text required' });

  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return res.status(400).json({ error: 'empty csv' });

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (names) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const ci = {
    name: idx(['name']),
    rank: idx(['rank', 'grade']),
    section: idx(['section', 'directorate', 'unit']),
    phone: idx(['phone', 'cell', 'contact', 'number']),
    role: idx(['role', 'duty', 'position']),
    pool: idx(['pool']),
    status: idx(['status', 'chit', 'remarks']),
  };

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const name = ci.name >= 0 ? cols[ci.name] : '';
    if (!name) continue;
    const section = ci.section >= 0 ? cols[ci.section].toUpperCase() : '';
    parsed.push({
      id: `${section || 'UNK'}-${i}-${Date.now()}`.toLowerCase(),
      name,
      rank: ci.rank >= 0 ? cols[ci.rank] : '',
      section,
      phone: ci.phone >= 0 ? cols[ci.phone] : '',
      role: ci.role >= 0 ? cols[ci.role].toUpperCase() : '',
      pool: ci.pool >= 0 ? cols[ci.pool].toUpperCase() : (['HQ', 'CSSC'].includes(section) ? 'MSB' : 'MEF_CE'),
      status: ci.status >= 0 ? cols[ci.status] : '',
    });
  }

  const result = replace ? parsed : [...getPersonnel(), ...parsed];
  setPersonnel(result);
  res.json({ imported: parsed.length, personnel: result });
});

export default router;
