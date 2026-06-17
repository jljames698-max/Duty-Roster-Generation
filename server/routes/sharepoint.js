// sharepoint.js — SharePoint sync + auth endpoints. All degrade gracefully.

import express from 'express';
import { status, runSync } from '../services/sharepointSync.js';
import { getAuthCodeUrl, acquireTokenByCode, isConfigured, clearToken } from '../services/sharepointAuth.js';

const router = express.Router();

// 🟢 / 🔴 status indicator data.
router.get('/status', async (req, res) => {
  try {
    res.json(await status());
  } catch (e) {
    res.json({ configured: isConfigured(), connected: false, state: 'offline', error: e.message });
  }
});

// "Sync Now" — pull Archive + Working, rebuild history + personnel.
router.post('/sync', async (req, res) => {
  try {
    const result = await runSync();
    res.json({ ok: true, ...result });
  } catch (e) {
    // Graceful failure → caller shows 🔴 and offers manual upload.
    res.status(200).json({ ok: false, fallback: 'manual-upload', error: e.message });
  }
});

// Begin the CAC/Azure AD auth flow — returns a URL to open in the browser.
router.get('/auth-url', async (req, res) => {
  try {
    const url = await getAuthCodeUrl();
    res.json({ url });
  } catch (e) {
    res.status(200).json({ error: e.message, configured: isConfigured() });
  }
});

// OAuth redirect target.
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');
  try {
    await acquireTokenByCode(code);
    res.send('<html><body style="font-family:sans-serif;background:#0b1220;color:#e5e7eb"><h2>✅ SharePoint connected.</h2><p>You can close this window and return to the app.</p></body></html>');
  } catch (e) {
    res.status(500).send(`Authentication failed: ${e.message}`);
  }
});

router.post('/disconnect', (req, res) => {
  clearToken();
  res.json({ ok: true });
});

export default router;
