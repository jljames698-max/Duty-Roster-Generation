import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

export default function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { setStatus(await api.spStatus()); } catch { setStatus({ state: 'offline' }); }
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api.spSync();
      if (r.ok) setMsg(`Synced: ${r.rosters ?? 0} rosters, ${r.personnel ?? 0} personnel`);
      else setMsg(`🔴 ${r.error} — using local files`);
    } catch (e) {
      setMsg(`🔴 ${e.message}`);
    } finally {
      setBusy(false);
      load();
    }
  };

  const connected = status?.connected;
  const configured = status?.configured;
  const dot = connected ? '🟢' : configured ? '🟡' : '🔴';
  const text = connected
    ? 'SharePoint Connected'
    : configured
      ? 'SharePoint — Auth Required'
      : 'SharePoint Offline — Local Files';

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <span>{dot}</span>
          <span className="font-semibold">{text}</span>
        </div>
        <div className="text-xs text-gray-400">
          {status?.lastSync ? `Last sync: ${new Date(status.lastSync).toLocaleString()}` : 'Never synced'}
          {msg && <span className="ml-2">{msg}</span>}
        </div>
      </div>
      <button className="btn-ghost text-xs py-1" onClick={sync} disabled={busy}>
        {busy ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  );
}
