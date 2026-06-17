import React, { useState } from 'react';
import { exportRoster, api } from '../utils/api.js';

export default function ExportButton({ roster }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const doExport = async () => {
    setBusy(true); setMsg('');
    try {
      await exportRoster(roster);
      setMsg('Downloaded .xlsx');
    } catch (e) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  const finalize = async (upload) => {
    setBusy(true); setMsg('');
    try {
      const r = await api.finalize({ roster, uploadToSharePoint: upload });
      if (r.upload?.error) setMsg(`Saved locally. SharePoint upload: ${r.upload.error}`);
      else if (r.upload) setMsg('Saved to history + uploaded to SharePoint Working folder.');
      else setMsg('Saved to local history.');
    } catch (e) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-primary" onClick={doExport} disabled={busy || !roster}>Export to Excel</button>
      <button className="btn-ghost" onClick={() => finalize(false)} disabled={busy || !roster}>Save to History</button>
      <button className="btn-ghost" onClick={() => finalize(true)} disabled={busy || !roster}>Save + Upload to SharePoint</button>
      {msg && <span className="text-xs text-gray-400">{msg}</span>}
    </div>
  );
}
