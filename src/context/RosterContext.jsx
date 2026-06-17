import React, { createContext, useContext, useState } from 'react';

const RosterContext = createContext(null);

export function RosterProvider({ children }) {
  const now = new Date();
  const [target, setTarget] = useState({ year: 2026, month: 6, mefCeStart: 16 });
  const [roster, setRoster] = useState(null);
  const [fairness, setFairness] = useState(null);

  return (
    <RosterContext.Provider value={{ now, target, setTarget, roster, setRoster, fairness, setFairness }}>
      {children}
    </RosterContext.Provider>
  );
}

export function useRoster() {
  const ctx = useContext(RosterContext);
  if (!ctx) throw new Error('useRoster must be used within RosterProvider');
  return ctx;
}
