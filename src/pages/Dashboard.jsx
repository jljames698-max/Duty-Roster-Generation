import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MonthSelector from '../components/MonthSelector.jsx';
import FairnessScore from '../components/FairnessScore.jsx';
import { useRoster } from '../context/RosterContext.jsx';
import { api } from '../utils/api.js';

export default function Dashboard() {
  const { target, setTarget, setRoster, setFairness, fairness } = useRoster();
  const [calendar, setCalendar] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [burden, setBurden] = useState(null);
  const [owed, setOwed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fillMsb, setFillMsb] = useState(true);
  const navigate = useNavigate();

  const refresh = async () => {
    setErr('');
    try {
      const [cal, ppl, hist, ow] = await Promise.all([
        api.calendar(target.year, target.month, target.mefCeStart),
        api.personnel(),
        api.history(),
        api.owed(target.year, target.month),
      ]);
      setCalendar(cal);
      setPersonnel(ppl.personnel);
      setBurden(hist.burden);
      setOwed(ow);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [target]);

  const generate = async () => {
    setBusy(true); setErr('');
    try {
      const { roster, fairness } = await api.generate({ ...target, fillMsb });
      setRoster(roster);
      setFairness(fairness);
      navigate('/review');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const holidays = calendar?.days.filter((d) => d.isHoliday) || [];
  const weekends = calendar?.days.filter((d) => d.isWeekend) || [];
  const countBy = (pool, role) => personnel.filter((p) => p.pool === pool && (p.role === role)).length;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">Generate Monthly Roster</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <MonthSelector target={target} onChange={setTarget} />
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fillMsb} onChange={(e) => setFillMsb(e.target.checked)} />
              Auto-fill MSB days (1–{target.mefCeStart - 1})
            </label>
            <button className="btn-primary" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate Roster'}
            </button>
          </div>
        </div>
        {err && <div className="mt-3 text-red-400 text-sm">⚠ {err}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <h3 className="font-bold mb-2">Holidays — {calendar?.label}</h3>
          {holidays.length ? (
            <ul className="text-sm space-y-1">
              {[...new Map(holidays.map((h) => [h.holiday, h])).values()].map((h) => (
                <li key={h.holiday} className="flex justify-between">
                  <span className="text-orange-300 font-semibold">{h.holiday}</span>
                </li>
              ))}
              <li className="text-xs text-gray-400 pt-1">{holidays.length} liberty days, {weekends.length} weekend days</li>
            </ul>
          ) : <div className="text-sm text-gray-400">No federal holidays this month. {weekends.length} weekend days.</div>}
        </div>

        <div className="card">
          <h3 className="font-bold mb-2">Personnel Pool</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>MSB OOD</span><span className="font-bold">{countBy('MSB', 'OOD')}</span></div>
            <div className="flex justify-between"><span>MSB AOOD</span><span className="font-bold">{countBy('MSB', 'AOOD')}</span></div>
            <div className="flex justify-between"><span>MEF CE OOD</span><span className="font-bold">{countBy('MEF_CE', 'OOD')}</span></div>
            <div className="flex justify-between"><span>MEF CE AOOD</span><span className="font-bold">{countBy('MEF_CE', 'AOOD')}</span></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-2">Sections Owed Lighter Month</h3>
          {owed.length ? (
            <ul className="text-sm space-y-1">
              {owed.map((o) => (
                <li key={o.section} className="flex items-center gap-2">
                  <span>{o.level === 'red' ? '🔴' : '🟡'}</span>
                  <span className="font-semibold">{o.section}</span>
                  <span className="text-gray-400 text-xs">{o.reason}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-gray-400">None flagged — all sections clear.</div>}
        </div>

        <div className="card">
          <h3 className="font-bold mb-2">History Loaded</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Months</span><span className="font-bold">{burden?.months?.length || 0}</span></div>
            <div className="flex justify-between"><span>Sections tracked</span><span className="font-bold">{burden ? Object.keys(burden.bySection).length : 0}</span></div>
          </div>
        </div>
      </div>

      {fairness && <FairnessScore fairness={fairness} />}
    </div>
  );
}
