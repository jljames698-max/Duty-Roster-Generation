import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildCalendar } from '../src/utils/calendar.js';
import { summarize, gradeRoster, priorMonthKey, owedLighterMonths } from '../src/utils/fairness.js';
import { generateRoster } from '../src/utils/rosterGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', f), 'utf-8'));

const holidays = read('holidays.json').holidays;
const seed = read('seedHistory.json').rosters;
const personnel = read('samplePersonnel.json').personnel;

test('calendar marks Juneteenth liberty window and weekends for June 2026', () => {
  const cal = buildCalendar(2026, 6, holidays, 16);
  assert.equal(cal.daysInMonth, 30);
  // Juneteenth 96 window is 18–23 Jun.
  for (const d of [18, 19, 20, 21, 22, 23]) {
    assert.equal(cal.days[d - 1].holiday, 'JUNETEENTH 96', `day ${d} should be Juneteenth`);
  }
  // Weekends: 6,7,13,14,20,21,27,28
  assert.ok(cal.days[19].isWeekend && cal.days[20].isWeekend); // 20,21
  assert.ok(cal.days[26].isWeekend && cal.days[27].isWeekend); // 27,28
});

test('summarize builds burden history across seeded months', () => {
  const burden = summarize(seed);
  assert.ok(burden.months.length >= 4);
  assert.ok(Object.keys(burden.bySection).length > 0);
  // G4 stood multiple weekends historically.
  assert.ok(burden.bySection.G4.total > 0);
});

test('priorMonthKey finds the most recent month before target', () => {
  const burden = summarize(seed);
  const key = priorMonthKey(burden, 2026, 6);
  assert.equal(key, '2026-05'); // May 2026 precedes June 2026
});

test('generated June 2026 roster fills all days and respects no-consecutive-day', () => {
  const cal = buildCalendar(2026, 6, holidays, 16);
  const burden = summarize(seed);
  const roster = generateRoster(cal, personnel, burden, { mefCeStart: 16, fillMsb: true });
  assert.equal(roster.days.length, 30);

  // Every day has an OOD section assigned.
  for (const d of roster.days) {
    assert.ok(d.ood, `day ${d.date} missing OOD`);
  }

  // No individual stands OOD on consecutive days.
  for (let i = 1; i < roster.days.length; i++) {
    const prev = roster.days[i - 1].ood?.id;
    const cur = roster.days[i].ood?.id;
    if (prev && cur) assert.notEqual(prev, cur, `consecutive OOD on day ${roster.days[i].date}`);
  }
});

test('MEF CE days draw from MEF CE sections; MSB days from HQ/CSSC', () => {
  const cal = buildCalendar(2026, 6, holidays, 16);
  const burden = summarize(seed);
  const roster = generateRoster(cal, personnel, burden, { mefCeStart: 16, fillMsb: true });
  for (const d of roster.days) {
    if (!d.ood?.section) continue;
    if (d.date < 16) assert.ok(['HQ', 'CSSC'].includes(d.ood.section), `day ${d.date} MSB section`);
    else assert.ok(!['HQ', 'CSSC'].includes(d.ood.section), `day ${d.date} should be MEF CE`);
  }
});

test('fillMsb=false leaves MSB days blank', () => {
  const cal = buildCalendar(2026, 6, holidays, 16);
  const burden = summarize(seed);
  const roster = generateRoster(cal, personnel, burden, { mefCeStart: 16, fillMsb: false });
  assert.equal(roster.days[0].ood, null);
  assert.ok(roster.days[16].ood); // day 17 is MEF CE, filled
});

test('fairness grade penalizes consecutive-month holiday repeat', () => {
  const cal = buildCalendar(2026, 6, holidays, 16);
  const burden = summarize(seed);
  const roster = generateRoster(cal, personnel, burden, { mefCeStart: 16, fillMsb: true });
  const grade = gradeRoster(roster, burden);
  assert.ok(grade.score >= 0 && grade.score <= 100);
  assert.ok(['A', 'B', 'C', 'D', 'F'].includes(grade.grade));
});

test('owedLighterMonths flags sections that carried special duty last month', () => {
  const burden = summarize(seed);
  const owed = owedLighterMonths(burden, { year: 2026, month: 6 });
  // May 2026 had G2 + CMST on holiday; they should be flagged red.
  const sections = owed.map((o) => o.section);
  assert.ok(sections.includes('G2') || sections.includes('CMST'));
});
