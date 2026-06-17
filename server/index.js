// index.js — Express API server for the I MSB / I MEF CE Duty Roster Generator.
// Runs locally only (no cloud hosting). Serves the API and, in production, the
// built frontend. The SharePoint connection is outbound-only.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import rosterRoutes from './routes/roster.js';
import personnelRoutes from './routes/personnel.js';
import historyRoutes from './routes/history.js';
import sharepointRoutes from './routes/sharepoint.js';
import { getSections } from './services/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/api/sections', (req, res) => res.json(getSections()));

app.use('/api/roster', rosterRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/sharepoint', sharepointRoutes);
// OAuth redirect lives at /auth/callback per the .env redirect URI.
app.use('/auth', sharepointRoutes);

// Serve the built frontend in production (npm run build → dist/).
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  I MSB Duty Roster API → http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health\n`);
});
