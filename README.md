# I MSB / I MEF CE OOD–AOOD Duty Roster Generator

A **local web application** that automatically generates monthly OOD/AOOD duty
rosters for I Marine Expeditionary Force Support Battalion (I MSB), enforcing
**fair and equitable** allocation of weekend and holiday duty across sections
using historical roster data.

It handles the split responsibility between MSB organic companies (HQ Co, CSSC)
for roughly dates **1–15** and I MEF Command Element directorates (G1–G8, CMST)
for roughly dates **16–end of month**.

> **POC:** 1stLt Joseph, James L. — HQ Co XO / S-6 Officer, I MSB.

---

## Quick start

```bash
npm install
npm run dev        # launches API (http://localhost:3001) + UI (http://localhost:5173)
```

Open **http://localhost:5173**. The app ships seeded with 5 months of historical
roster data and sample personnel, so you can generate a roster immediately —
**no SharePoint or network connection required.**

Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Run backend + frontend together (development) |
| `npm run build` | Build the frontend into `dist/` |
| `npm run server` | Run the API only (serves `dist/` if built) |
| `npm test` | Run the fairness / generator / calendar unit tests |

---

## How it works

### 1. Calendar & holiday engine (`src/utils/calendar.js`)
Computes every day of the selected month, marks weekends, and applies the
**CY26 I MEF Special Liberty Schedule** — any date inside a holiday's
96/72-hour liberty window is labeled (e.g. `JUNETEENTH 96`). The MEF CE window
start (default 16) is configurable per month.

### 2. Fairness algorithm (`src/utils/fairness.js`) — the core
- Summarizes historical rosters into a **burden database** (total / weekend /
  holiday duties per section per month).
- **No section gets weekend or holiday duty in consecutive months.** A section
  that carried a holiday last month is heavily penalized from carrying one
  again; weekend repeats are penalized too.
- Special days (holidays first, then weekends) are assigned to the **cleanest**
  sections first; weekdays balance the totals.
- Produces a **fairness grade (A–F)** with explicit flags for any violation, so
  the watch officer can swap manually with full transparency.

It is a standalone, independently testable module (see `test/fairness.test.js`).

### 3. Roster generator (`src/utils/rosterGenerator.js`)
- MSB window (1–15): HQ/CSSC, balanced by eligible strength (toggle to leave
  blank for MSB to fill manually).
- MEF CE window (16–end): directorate sections chosen by the fairness scorer.
- Honors **rank eligibility**, **duty exemptions** (BnO 1601.1 para 4.d.4),
  **availability** (leave/TAD/field), and **no consecutive-day duty**.
- Soft preference for OOD and AOOD from different companies.
- Fills the per-element **Supernumerary** rows.

### 4. Excel I/O (`src/utils/excelExport.js`, `excelParser.js`)
- **Export** produces a `.xlsx` matching the established template: title row,
  `DATE | DAY | OOD | SECTION | OOD# | AOOD | SECTION | AOOD# | Holiday`
  headers, Calibri 8/10pt bold centered, exact column widths, **yellow**
  weekends, **amber** holidays, **black** supernumerary rows, thin borders.
- **Parser** reads completed rosters back into the burden database, tolerant of
  filename and header variation. Phone numbers are preserved as strings.

---

## Personnel

- **Roles:** OOD (Capt, 1stLt, 2ndLt, CWO2–CWO5, WO, GySgt, SSgt) and
  AOOD (Sgt, Cpl).
- Manage on the **Personnel** page: add/edit/remove, CSV import, mark
  availability per date, and set exemption status (e.g. `legal hold`,
  `limited duty no driving`, `no weapons`).
- CSV headers (flexible order): `Name, Rank, Section, Phone, Role, Pool, Status`.

---

## SharePoint integration (optional enhancement)

The app is **fully functional without SharePoint**. When enabled, it auto-syncs
roster archives and manpower rosters from the DoD tenant.

Status indicator: 🟢 Connected · 🟡 Auth required · 🔴 Offline (local files).

### Enabling it (DoD / NMCI environment)

1. **Register an Azure AD app** in the USMC tenant (`usmc.sharepoint-mil.us`).
   This typically requires coordination with the unit Cyber Security Manager or
   I MEF G-6 for tenant-level app permissions.
   - Platform: **Mobile and desktop** / public client.
   - Redirect URI: `http://localhost:3001/auth/callback`.
   - Delegated Graph permissions: `Sites.Read.All`, `Files.Read.All`,
     `Files.ReadWrite.All`.
2. Copy `.env.example` → `.env` and fill in:
   ```
   SHAREPOINT_CLIENT_ID=<app (client) id>
   SHAREPOINT_TENANT_ID=<USMC tenant id>
   ```
3. Restart the app. On **Settings → Connect / Authenticate**, a Microsoft
   consent screen opens in your browser and leverages your existing **CAC**
   session (no username/password typed).
4. Click **Sync Now** — the app scans `Archive/` for completed rosters and
   `Working/` for manpower rosters, rebuilds the burden history, and loads the
   personnel pools.

Authority uses the **DoD cloud** (`login.microsoftonline.us`).

### Expected library layout
```
OOD-AOOD Duty/
├── Archive/    # completed rosters: [Month]_[Year]_OOD_AOOD_Duty_Roster.xlsx
├── Working/    # current draft + MSB / MEF CE manpower rosters
└── References/ # BnO, I MEFBul, templates
```
Files are matched by pattern (e.g. names containing `Duty_Roster` + a month/year,
or `Manpower`), so minor naming variation is tolerated.

### Graceful degradation
If the app registration isn't done yet, permissions are denied, or the network
is unavailable, every SharePoint call fails softly and the app falls back to
manual upload (History page) and manual personnel entry. SharePoint can be
enabled later purely via `.env` — no code changes.

---

## Project structure

```
src/
  data/        holidays.json, sections.json, samplePersonnel.json, seedHistory.json
  utils/       calendar.js, fairness.js, rosterGenerator.js, excelExport.js,
               excelParser.js, api.js
  components/  SyncStatus, MonthSelector, RosterTable, FairnessScore,
               BurdenAnalysis, PersonnelManager, ExportButton
  pages/       Dashboard, Personnel, History, Review, Settings
  context/     RosterContext.jsx
server/
  index.js     Express API (local only; serves dist/ in production)
  routes/      roster.js, personnel.js, history.js, sharepoint.js
  services/    sharepointAuth, sharepointClient, sharepointSync,
               manpowerParser, store
  data/        local JSON cache (gitignored): personnel, history, syncState
test/          fairness.test.js
```

---

## Notes
- Runs **locally only** — no cloud hosting. SharePoint access is outbound API
  calls, not inbound webhooks.
- Port is configurable via `PORT` in `.env` (default 3001) for NMCI port
  constraints.
- Section codes normalize internally: `COMMSTRAT → CMST`.
- All data persists between sessions in `server/data/` so the app works offline
  after the first sync.
- Reference: **BnO 1601.1** and the **CY26 I MEFBul 1050** special liberty
  schedule.
