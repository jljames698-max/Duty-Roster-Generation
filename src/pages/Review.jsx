import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RosterTable from '../components/RosterTable.jsx';
import FairnessScore from '../components/FairnessScore.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useRoster } from '../context/RosterContext.jsx';
import { api } from '../utils/api.js';

export default function Review() {
  const { roster, setRoster, fairness, setFairness } = useRoster();
  const [personnel, setPersonnel] = useState([]);
  const [unassigned, setUnassigned] = useState(roster?.unassigned || []);

  useEffect(() => {
    api.personnel().then((r) => setPersonnel(r.personnel)).catch(() => {});
  }, []);

  // Re-grade whenever the roster is edited.
  const handleChange = async (updated) => {
    setRoster(updated);
    try { setFairness(await api.grade(updated)); } catch { /* ignore */ }
  };

  if (!roster) {
    return (
      <div className="card text-center">
        <p className="text-gray-300">No roster generated yet.</p>
        <Link to="/" className="btn-primary inline-block mt-3">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{roster.label} — Roster Review</h2>
        <ExportButton roster={roster} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <FairnessScore fairness={fairness} />
          {unassigned?.length > 0 && (
            <div className="card border-red-700/60">
              <h3 className="font-bold text-red-300 mb-2">Unfilled / Forced Slots ({unassigned.length})</h3>
              <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {unassigned.map((u, i) => (
                  <li key={i}>Day {u.date} — {u.role || 'section'}: {u.reason}</li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-2">Resolve by adding personnel or swapping assignments below.</p>
            </div>
          )}
          <div className="card text-xs text-gray-400">
            <p className="font-semibold text-gray-300 mb-1">Editing</p>
            Click any OOD/AOOD cell to swap to an eligible alternate. The fairness score updates live. Yellow = weekend, amber = holiday.
          </div>
        </div>
        <div className="lg:col-span-2">
          <RosterTable roster={roster} personnel={personnel} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
