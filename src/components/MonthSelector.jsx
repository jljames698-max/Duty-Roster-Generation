import React from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthSelector({ target, onChange }) {
  const years = [2025, 2026, 2027];
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="label">Month</label>
        <select
          className="input"
          value={target.month}
          onChange={(e) => onChange({ ...target, month: Number(e.target.value) })}
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">Year</label>
        <select
          className="input"
          value={target.year}
          onChange={(e) => onChange({ ...target, year: Number(e.target.value) })}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">MEF CE Window Start</label>
        <select
          className="input"
          value={target.mefCeStart}
          onChange={(e) => onChange({ ...target, mefCeStart: Number(e.target.value) })}
        >
          {[14, 15, 16, 17].map((d) => <option key={d} value={d}>Day {d}</option>)}
        </select>
      </div>
    </div>
  );
}
