import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Personnel from './pages/Personnel.jsx';
import History from './pages/History.jsx';
import Review from './pages/Review.jsx';
import Settings from './pages/Settings.jsx';
import SyncStatus from './components/SyncStatus.jsx';
import { RosterProvider } from './context/RosterContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/personnel', label: 'Personnel' },
  { to: '/history', label: 'History' },
  { to: '/review', label: 'Review' },
  { to: '/settings', label: 'Settings' },
];

export default function App() {
  return (
    <RosterProvider>
      <div className="min-h-screen flex flex-col">
        <header className="bg-navy-800 border-b border-navy-600">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-gold-400 font-black text-lg tracking-tight">I MSB</div>
              <div>
                <div className="font-bold leading-tight">OOD / AOOD Duty Roster Generator</div>
                <div className="text-xs text-gray-400">I Marine Expeditionary Force Support Battalion</div>
              </div>
            </div>
            <SyncStatus />
          </div>
          <nav className="max-w-7xl mx-auto px-4 flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-semibold border-b-2 ${
                    isActive ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/history" element={<History />} />
            <Route path="/review" element={<Review />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <footer className="text-center text-xs text-gray-500 py-4 border-t border-navy-700">
          POC: 1stLt Joseph, James L. — HQ Co XO / S-6, I MSB · Runs locally · BnO 1601.1
        </footer>
      </div>
    </RosterProvider>
  );
}
