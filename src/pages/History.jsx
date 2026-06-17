import React, { useEffect, useState } from 'react';
import BurdenAnalysis from '../components/BurdenAnalysis.jsx';
import { api, uploadHistory } from '../utils/api.js';

export default function History() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => setData(await api.history());
  useEffect(() => { load(); }, []);

  const onUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true); setMsg('');
    try {
      const r = await uploadHistory(files);
      const ok = r.results.filter((x) => !x.error).length;
      const bad = r.results.filter((x) => x.error);
      setMsg(`Parsed ${ok} roster(s).${bad.length ? ` ${bad.length} failed: ${bad.map((b) => b.file).join(', ')}` : ''}`);
      load();
    } catch (err) { setMsg(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const del = async (r) => { await api.deleteHistory(r.year, r.month); load(); };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-bold mb-2">Historical Roster Import</h2>
        <p className="text-sm text-gray-400 mb-3">
          Upload completed <code>.xlsx</code> rosters (fallback when SharePoint is offline). Files are parsed into the
          burden database that drives the fairness algorithm.
        </p>
        <input type="file" multiple accept=".xlsx" onChange={onUpload} disabled={busy} className="text-sm" />
        {msg && <div className="mt-2 text-sm text-gray-300">{msg}</div>}
      </div>

      <BurdenAnalysis burden={data?.burden} />

      <div className="card">
        <h3 className="font-bold mb-2">Loaded Months ({data?.rosters?.length || 0})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-gray-400 text-xs"><th className="text-left py-1">Month</th><th>Days</th><th></th></tr></thead>
          <tbody>
            {(data?.rosters || []).slice().sort((a, b) => (b.year - a.year) || (b.month - a.month)).map((r) => (
              <tr key={`${r.year}-${r.month}`} className="border-t border-navy-700">
                <td className="py-1 font-semibold">{r.label || `${r.year}-${r.month}`}</td>
                <td className="text-center">{r.days?.length || 0}</td>
                <td className="text-center"><button className="text-red-400 hover:text-red-300" onClick={() => del(r)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
