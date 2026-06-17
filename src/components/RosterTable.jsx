import React from 'react';

const OOD_RANKS = ['Capt', '1stLt', '2ndLt', 'CWO2', 'CWO3', 'CWO4', 'CWO5', 'WO', 'GySgt', 'SSgt'];
const AOOD_RANKS = ['Sgt', 'Cpl'];

function eligible(personnel, role) {
  return personnel.filter((p) => (p.role ? p.role === role : (role === 'OOD' ? OOD_RANKS : AOOD_RANKS).includes(p.rank)));
}

// One assignment cell: name + section + phone, editable via a person picker.
function AssignmentCell({ assignment, options, onPick }) {
  return (
    <select
      className="bg-transparent w-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-gold-500 rounded cursor-pointer"
      value={assignment?.id || ''}
      onChange={(e) => onPick(options.find((o) => o.id === e.target.value) || null)}
      title={assignment?.phone || ''}
    >
      <option value="">— unassigned —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name} [{o.section}]</option>
      ))}
    </select>
  );
}

export default function RosterTable({ roster, personnel = [], onChange }) {
  if (!roster) return null;
  const oodOptions = eligible(personnel, 'OOD');
  const aoodOptions = eligible(personnel, 'AOOD');

  const updateDay = (date, role, person) => {
    const days = roster.days.map((d) => {
      if (d.date !== date) return d;
      const a = person
        ? { id: person.id, name: person.name, section: person.section, phone: person.phone || '', rank: person.rank }
        : { name: '', section: '', phone: '' };
      return { ...d, [role]: a };
    });
    onChange?.({ ...roster, days });
  };

  return (
    <div className="overflow-x-auto card p-0">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-navy-700 text-gray-200">
            {['DATE', 'DAY', 'OOD', 'SECT', 'OOD#', 'AOOD', 'SECT', 'AOOD#', 'HOLIDAY'].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-bold border border-navy-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.days.map((d) => {
            const cls = d.isHoliday ? 'row-holiday' : d.isWeekend ? 'row-weekend' : '';
            return (
              <tr key={d.date} className={`${cls} border-b border-navy-700`}>
                <td className="px-2 py-1 border border-navy-700 font-bold">{d.date}</td>
                <td className="px-2 py-1 border border-navy-700">{d.day}</td>
                <td className="px-2 py-1 border border-navy-700 min-w-[180px]">
                  <AssignmentCell assignment={d.ood} options={oodOptions} onPick={(p) => updateDay(d.date, 'ood', p)} />
                </td>
                <td className="px-2 py-1 border border-navy-700 font-semibold">{d.ood?.section || ''}</td>
                <td className="px-2 py-1 border border-navy-700 text-xs">{d.ood?.phone || ''}</td>
                <td className="px-2 py-1 border border-navy-700 min-w-[180px]">
                  <AssignmentCell assignment={d.aood} options={aoodOptions} onPick={(p) => updateDay(d.date, 'aood', p)} />
                </td>
                <td className="px-2 py-1 border border-navy-700 font-semibold">{d.aood?.section || ''}</td>
                <td className="px-2 py-1 border border-navy-700 text-xs">{d.aood?.phone || ''}</td>
                <td className="px-2 py-1 border border-navy-700 text-xs font-bold text-orange-300">{d.holiday || ''}</td>
              </tr>
            );
          })}
          {(roster.supernumerary || []).map((s) => (
            <tr key={s.element} className="row-super">
              <td className="px-2 py-1 border border-navy-700 font-bold" colSpan={2}>{s.element} — SUPERNUMERARY</td>
              <td className="px-2 py-1 border border-navy-700" colSpan={2}>{s.name || ''}</td>
              <td className="px-2 py-1 border border-navy-700" colSpan={5}>{s.phone || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
