import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [authUrl, setAuthUrl] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => { try { setStatus(await api.spStatus()); } catch { setStatus(null); } };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setMsg('');
    try {
      const r = await api.spAuthUrl();
      if (r.url) { setAuthUrl(r.url); window.open(r.url, '_blank', 'width=600,height=700'); }
      else setMsg(r.error || 'SharePoint not configured. Set credentials in .env.');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold">Settings</h2>

      <div className="card">
        <h3 className="font-bold mb-2">SharePoint Connection</h3>
        <div className="text-sm space-y-1">
          <Row k="Tenant" v={status?.config?.tenant || 'usmc.sharepoint-mil.us'} />
          <Row k="Site" v={status?.config?.site || 'IMSBHeadquartersCompany'} />
          <Row k="Configured" v={status?.configured ? 'Yes (.env has client/tenant id)' : 'No — using local files'} />
          <Row k="Status" v={status?.connected ? '🟢 Connected' : status?.configured ? '🟡 Auth required' : '🔴 Offline'} />
          <Row k="Last sync" v={status?.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'} />
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={connect}>Connect / Authenticate (CAC)</button>
          <button className="btn-ghost" onClick={load}>Refresh</button>
        </div>
        {msg && <div className="mt-2 text-sm text-orange-300">{msg}</div>}
        {authUrl && <div className="mt-2 text-xs text-gray-400 break-all">Auth URL: {authUrl}</div>}
      </div>

      <div className="card text-sm text-gray-300 space-y-2">
        <h3 className="font-bold">Setup Notes</h3>
        <p>To enable SharePoint auto-sync on a government machine:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Coordinate an Azure AD app registration in the USMC tenant (Cyber Security Manager / I MEF G-6).</li>
          <li>Add <code>SHAREPOINT_CLIENT_ID</code> and <code>SHAREPOINT_TENANT_ID</code> to <code>.env</code>.</li>
          <li>Restart the app and click <em>Connect / Authenticate</em> — the CAC consent screen opens in your browser.</li>
          <li>Once connected, use <em>Sync Now</em> to pull Archive rosters + Working manpower files automatically.</li>
        </ol>
        <p className="text-gray-400">Without SharePoint, everything works via manual upload (History page) and manual personnel entry.</p>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between border-b border-navy-700 py-1">
      <span className="text-gray-400">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
