import React from 'react';
import PersonnelManager from '../components/PersonnelManager.jsx';

export default function Personnel() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Personnel Management</h2>
      <p className="text-sm text-gray-400">
        Eligible OOD/AOOD watch standers by section. Mark availability and exemption status per BnO 1601.1.
        Auto-populated from SharePoint manpower rosters when connected.
      </p>
      <PersonnelManager />
    </div>
  );
}
