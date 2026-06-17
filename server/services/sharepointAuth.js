// sharepointAuth.js — MSAL token acquisition for the DoD SharePoint tenant.
//
// Designed for graceful degradation: if the Azure AD app registration is not
// configured (no CLIENT_ID/TENANT_ID in .env), every call reports "not
// configured" and the rest of the app falls back to local files. When the
// S-6 completes the app registration, set the .env values and this lights up
// with no code changes.
//
// Auth strategy (priority order per the build spec):
//   1. Authorization Code flow (@azure/msal-node) — interactive, leverages
//      the browser's existing CAC session. Implemented here.
//   2. Delegated browser auth — would be wired on the frontend (msal-browser).
//   3. Manual upload fallback — handled by the rest of the app.

import { PublicClientApplication, LogLevel } from '@azure/msal-node';

const SCOPES = ['Sites.Read.All', 'Files.Read.All', 'Files.ReadWrite.All'];

let pca = null;
let cachedToken = null; // { token, expiresOn }

export function spConfig() {
  return {
    tenant: process.env.SHAREPOINT_TENANT || 'usmc.sharepoint-mil.us',
    site: process.env.SHAREPOINT_SITE || 'IMSBHeadquartersCompany',
    clientId: process.env.SHAREPOINT_CLIENT_ID || '',
    tenantId: process.env.SHAREPOINT_TENANT_ID || '',
    redirectUri: process.env.SHAREPOINT_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    archivePath: process.env.SP_ARCHIVE_PATH || 'OOD-AOOD Duty/Archive',
    workingPath: process.env.SP_WORKING_PATH || 'OOD-AOOD Duty/Working',
    referencePath: process.env.SP_REFERENCE_PATH || 'OOD-AOOD Duty/References',
  };
}

export function isConfigured() {
  const c = spConfig();
  return !!(c.clientId && c.tenantId);
}

function client() {
  if (pca) return pca;
  const c = spConfig();
  pca = new PublicClientApplication({
    auth: {
      clientId: c.clientId,
      authority: `https://login.microsoftonline.us/${c.tenantId}`, // .us = DoD/GCC-High cloud
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
      },
    },
  });
  return pca;
}

// Build the URL the user visits (in their CAC-authenticated browser) to consent.
export async function getAuthCodeUrl() {
  if (!isConfigured()) throw new Error('SharePoint not configured');
  const c = spConfig();
  return client().getAuthCodeUrl({ scopes: SCOPES, redirectUri: c.redirectUri });
}

// Exchange the returned code for an access token.
export async function acquireTokenByCode(code) {
  if (!isConfigured()) throw new Error('SharePoint not configured');
  const c = spConfig();
  const result = await client().acquireTokenByCode({ code, scopes: SCOPES, redirectUri: c.redirectUri });
  cachedToken = { token: result.accessToken, expiresOn: result.expiresOn };
  return cachedToken;
}

// Return a valid cached token, or null if we need (re)authentication.
export async function getAccessToken() {
  if (!isConfigured()) return null;
  if (cachedToken && cachedToken.expiresOn && new Date(cachedToken.expiresOn) > new Date(Date.now() + 60_000)) {
    return cachedToken.token;
  }
  // Try silent acquisition from any cached account.
  try {
    const accounts = await client().getTokenCache().getAllAccounts();
    if (accounts.length) {
      const result = await client().acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
      cachedToken = { token: result.accessToken, expiresOn: result.expiresOn };
      return cachedToken.token;
    }
  } catch {
    // fall through — interactive auth required
  }
  return null;
}

export function clearToken() {
  cachedToken = null;
}
