// sharepointClient.js — Thin Microsoft Graph wrapper (list / download / upload).
// All functions throw a descriptive error if SharePoint is unreachable so the
// caller can fall back to local files.

import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import { getAccessToken, spConfig, isConfigured } from './sharepointAuth.js';

async function graph() {
  const token = await getAccessToken();
  if (!token) throw new Error('No SharePoint access token (authentication required)');
  return Client.init({ authProvider: (done) => done(null, token) });
}

let siteCache = null;
let driveCache = null;

// Resolve the SharePoint site id from tenant + site name.
export async function getSiteId() {
  if (siteCache) return siteCache;
  const c = spConfig();
  const client = await graph();
  const site = await client.api(`/sites/${c.tenant}:/sites/${c.site}`).get();
  siteCache = site.id;
  return siteCache;
}

// Resolve the default document library drive id for the site.
export async function getDriveId() {
  if (driveCache) return driveCache;
  const siteId = await getSiteId();
  const client = await graph();
  const drive = await client.api(`/sites/${siteId}/drive`).get();
  driveCache = drive.id;
  return driveCache;
}

// List .xlsx files in a library folder path.
export async function listFiles(folderPath, ext = '.xlsx') {
  const client = await graph();
  const siteId = await getSiteId();
  const driveId = await getDriveId();
  const res = await client
    .api(`/sites/${siteId}/drives/${driveId}/root:/${folderPath}:/children`)
    .get();
  return (res.value || [])
    .filter((f) => f.file && f.name.toLowerCase().endsWith(ext))
    .map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      lastModified: f.lastModifiedDateTime,
      webUrl: f.webUrl,
    }));
}

// Download a file's contents as a Buffer.
export async function downloadFile(itemId) {
  const client = await graph();
  const siteId = await getSiteId();
  const driveId = await getDriveId();
  const arrayBuf = await client
    .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/content`)
    .responseType('arraybuffer')
    .get();
  return Buffer.from(arrayBuf);
}

// Upload (create/replace) a file in a folder by path.
export async function uploadFile(folderPath, filename, buffer) {
  const client = await graph();
  const siteId = await getSiteId();
  const driveId = await getDriveId();
  const res = await client
    .api(`/sites/${siteId}/drives/${driveId}/root:/${folderPath}/${filename}:/content`)
    .put(buffer);
  return { id: res.id, name: res.name, webUrl: res.webUrl };
}

export { isConfigured };
