import React from 'react';

// Visual month-over-month burden by section. Weekend/holiday counts get
// green/yellow/red cells so patterns jump out.
function cellColor(stat) {
  const special = (stat?.weekend || 0) + (stat?.holiday || 0);
  if (stat?.holiday) return 'bg-red-900/60 text-red-200';
  if (special >= 2) return 'bg-orange-900/60 text-orange-200';
  if (special === 1) return 'bg-yellow-900/50 text-yellow-200';
  if (stat?.total) return 'bg-navy-700 text-gray-300';
  return 'text-gray-600';
}

export default function BurdenAnalysis({ burden }) {
  if (!burden || !burden.months?.length) {
    return <div className="card text-gray-400">No historical data yet. Upload rosters or sync from SharePoint.</div>;
  }
  const sections = Object.keys(burden.bySection).sort();
  const months = burden.months;

  return (
    <div className="card overflow-x-auto">
      <h3 className="font-bold mb-3">Weekend / Holiday Burden by Section</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-gray-300">
            <th className="px-2 py-1 text-left border border-navy-600">Section</th>
            {months.map((m) => <th key={m} className="px-2 py-1 border border-navy-600">{m}</th>)}
            <th className="px-2 py-1 border border-navy-600">Σ Wknd</th>
            <th className="px-2 py-1 border border-navy-600">Σ Hol</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => {
            const total = burden.bySection[sec];
            return (
              <tr key={sec}>
                <td className="px-2 py-1 border border-navy-600 font-bold">{sec}</td>
                {months.map((m) => {
                  const stat = burden.byMonth[m]?.[sec];
                  return (
                    <td key={m} className={`px-2 py-1 border border-navy-600 text-center ${cellColor(stat)}`}>
                      {stat ? `${stat.total}` : '·'}
                      {stat && (stat.weekend || stat.holiday)
                        ? <span className="text-[10px] block">{stat.weekend ? `${stat.weekend}w` : ''}{stat.holiday ? ` ${stat.holiday}h` : ''}</span>
                        : null}
                    </td>
                  );
                })}
                <td className="px-2 py-1 border border-navy-600 text-center font-semibold">{total.weekend}</td>
                <td className="px-2 py-1 border border-navy-600 text-center font-semibold">{total.holiday}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-400">
        Cell shows total duties; <span className="text-yellow-300">w</span> = weekend, <span className="text-red-300">h</span> = holiday.
      </div>
    </div>
  );
}
