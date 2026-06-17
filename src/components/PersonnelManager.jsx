import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

const BLANK = { name: '', rank: '', section: '', phone: '', role: 'OOD', pool: 'MSB', status: '' };

export default function PersonnelManager() {
  const [personnel, setPersonnel] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');

  const load = async () => setPersonnel((await api.personnel()).personnel);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name) return;
    await api.addPerson(form);
    setForm(BLANK);
    load();
  };

  const update = async (id, patch) => { await api.updatePerson(id, patch); load(); };
  const remove = async (id) => { await api.deletePerson(id); load(); };

  const importCsv = async (replace) => {
    setMsg('');
    try {
      const r = await api.importCsv(csv, replace);
      setMsg(`Imported ${r.imported} personnel.`);
      setCsv('');
      load();
    } catch (e) { setMsg(e.message); }
  };

  // Mark a person unavailable for a comma-separated list of dates.
  const setUnavailable = async (p, text) => {
    const dates = text.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
    await update(p.id, { unavailable: dates });
  };

  const bySection = {};
  personnel
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.section?.toLowerCase().includes(filter.toLowerCase()))
    .forEach((p) => { (bySection[p.section || 'Unassigned'] ||= []).push(p); });

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-bold mb-3">Add Personnel</h3>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <input className="input" placeholder="Rank LastName, First" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Rank" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          <input className="input" placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option>OOD</option><option>AOOD</option>
          </select>
          <select className="input" value={form.pool} onChange={(e) => setForm({ ...form, pool: e.target.value })}>
            <option value="MSB">MSB</option><option value="MEF_CE">MEF CE</option>
          </select>
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
        <input className="input w-full mt-2" placeholder="Status / chit (e.g. 'limited duty no driving', 'legal hold')" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
      </div>

      <div className="card">
        <h3 className="font-bold mb-2">CSV Import</h3>
        <p className="text-xs text-gray-400 mb-2">Headers: Name, Rank, Section, Phone, Role, Pool, Status</p>
        <textarea className="input w-full h-24 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Name,Rank,Section,Phone,Role,Pool,Status&#10;Capt Smith John,Capt,G3,760-555-0000,OOD,MEF_CE," />
        <div className="flex gap-2 mt-2">
          <button className="btn-ghost" onClick={() => importCsv(false)} disabled={!csv}>Append</button>
          <button className="btn-ghost" onClick={() => importCsv(true)} disabled={!csv}>Replace All</button>
          {msg && <span className="text-xs text-gray-400 self-center">{msg}</span>}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Roster ({personnel.length})</h3>
          <input className="input" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {Object.keys(bySection).sort().map((sec) => (
          <div key={sec} className="mb-4">
            <div className="text-gold-400 font-bold text-sm mb-1">{sec} ({bySection[sec].length})</div>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs">
                <th className="text-left py-1">Name</th><th>Rank</th><th>Role</th><th>Phone</th><th>Status</th><th>Unavailable dates</th><th></th>
              </tr></thead>
              <tbody>
                {bySection[sec].map((p) => (
                  <tr key={p.id} className="border-t border-navy-700">
                    <td className="py-1">{p.name}</td>
                    <td className="text-center">{p.rank}</td>
                    <td className="text-center">
                      <select className="bg-transparent" value={p.role || ''} onChange={(e) => update(p.id, { role: e.target.value })}>
                        <option value="OOD">OOD</option><option value="AOOD">AOOD</option>
                      </select>
                    </td>
                    <td className="text-center text-xs">{p.phone}</td>
                    <td className="text-center text-xs text-orange-300">{p.status}</td>
                    <td className="text-center">
                      <input
                        className="bg-navy-900 border border-navy-700 rounded px-1 w-28 text-xs"
                        defaultValue={(p.unavailable || []).join(', ')}
                        placeholder="e.g. 5, 6, 19"
                        onBlur={(e) => setUnavailable(p, e.target.value)}
                      />
                    </td>
                    <td className="text-center"><button className="text-red-400 hover:text-red-300" onClick={() => remove(p.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
