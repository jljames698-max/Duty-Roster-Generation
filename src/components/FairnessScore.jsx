import React from 'react';

const GRADE_COLOR = {
  A: 'text-green-400', B: 'text-green-300', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400',
};

export default function FairnessScore({ fairness }) {
  if (!fairness) return null;
  const { score, grade, flags = [] } = fairness;
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Fairness Score</h3>
        <div className={`text-3xl font-black ${GRADE_COLOR[grade] || 'text-gray-300'}`}>
          {grade} <span className="text-lg text-gray-400">({score})</span>
        </div>
      </div>
      <div className="mt-2 h-2 bg-navy-900 rounded overflow-hidden">
        <div
          className={`h-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {flags.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span>{f.level === 'red' ? '🔴' : '🟡'}</span>
              <span className="text-gray-300">{f.msg}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-sm text-green-400">✅ No fairness violations detected.</div>
      )}
    </div>
  );
}
