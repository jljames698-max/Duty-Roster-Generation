// rosterGenerator.js — Core generation logic.
//
// Strategy:
//   1. Resolve eligible OOD / AOOD candidates (rank, exemptions, availability).
//   2. Walk the month; for each day pick the owning section (MSB organic for
//      dates < mefCeStart, a MEF CE directorate otherwise) using the fairness
//      scorer, processing holidays first, then weekends, then weekdays so the
//      heaviest slots get first pick of the cleanest sections.
//   3. Pick an individual within the section honoring no-consecutive-day and
//      intra-month rotation of special vs. weekday duty.
//   4. Assign AOOD (default from MSB pool, cross-company preference).
//   5. Fill supernumerary rows.

import { rankSections } from './fairness.js';

const OOD_RANKS = ['Capt', '1stLt', '2ndLt', 'CWO2', 'CWO3', 'CWO4', 'CWO5', 'WO', 'GySgt', 'SSgt'];
const AOOD_RANKS = ['Sgt', 'Cpl'];

// ── Eligibility ──────────────────────────────────────────────────────────
function statusExempts(status, role) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  // Full exemptions (BnO 1601.1 para 4.d.4).
  if (/legal|pending|investigation|exempt|weapon.*incapable|incapable.*weapon/.test(s)) return true;
  if (/no overnight|no.?overnight/.test(s)) return true; // duty is overnight
  // OOD-specific exemptions.
  if (role === 'OOD') {
    if (/no weapon|no.?weapon/.test(s)) return true; // OOD draws a weapon
    if (/no classified|no.?access|classified/.test(s)) return true;
  }
  // Light/limited duty is only eligible WITH an allowing chit keyword.
  if (/light duty|limited duty/.test(s)) {
    const hasChit = /no weapon|no overnight|no driving/.test(s);
    if (!hasChit) return true;
  }
  return false;
}

function isAvailable(person, date) {
  const u = person.unavailable || [];
  return !u.includes(date) && !u.includes(String(date));
}

function rankEligible(person, role) {
  if (role === 'OOD') return OOD_RANKS.includes(person.rank);
  if (role === 'AOOD') return AOOD_RANKS.includes(person.rank);
  return false;
}

function eligibleFor(person, role, date) {
  if (person.exempt) return false;
  if (statusExempts(person.status, role)) return false;
  if (!isAvailable(person, date)) return false;
  // Respect an explicit role on the record; otherwise fall back to rank.
  if (person.role && person.role !== role) {
    // Allow rank-based override only if record role missing.
    return false;
  }
  if (!person.role && !rankEligible(person, role)) return false;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function companyOf(section) {
  if (section === 'HQ' || section === 'CSSC') return section;
  return 'MEF_CE';
}

function toAssignment(p) {
  return { id: p.id, name: p.name, section: p.section, phone: p.phone || '', rank: p.rank };
}

// Pick the best individual in a section for a day.
function pickIndividual(candidates, day, ctx) {
  const { personDates, monthLoad, monthSpecial } = ctx;
  const eligible = candidates.filter((p) => eligibleFor(p, ctx.role, day.date));
  // No consecutive-day duty: exclude anyone standing either neighboring date.
  // (Days are processed special-first, not in order, so we must check both.)
  const free = eligible.filter((p) => {
    const dates = personDates[p.id];
    return !dates || (!dates.has(day.date - 1) && !dates.has(day.date + 1));
  });
  const pool = free.length ? free : eligible; // relax if forced
  if (!pool.length) return null;

  const special = day.isWeekend || day.isHoliday;
  return [...pool].sort((a, b) => {
    // Rotate special duty: prefer those with fewer special assignments so far.
    if (special) {
      const sa = monthSpecial[a.id] || 0;
      const sb = monthSpecial[b.id] || 0;
      if (sa !== sb) return sa - sb;
    }
    // Then balance total monthly load.
    const la = monthLoad[a.id] || 0;
    const lb = monthLoad[b.id] || 0;
    if (la !== lb) return la - lb;
    return a.id.localeCompare(b.id);
  })[0];
}

export function generateRoster(calendar, personnel, burden, config = {}) {
  const {
    mefCeStart = calendar.mefCeStart || 16,
    fillMsb = true,
    aoodPool = 'MSB', // 'MSB' = AOOD from HQ/CSSC (matches history); 'ANY' = any AOOD
  } = config;

  const msbSections = ['HQ', 'CSSC'];
  // MEF CE sections that actually have an eligible OOD in the pool.
  const mefSections = [...new Set(
    personnel.filter((p) => p.pool === 'MEF_CE' && (p.role === 'OOD' || OOD_RANKS.includes(p.rank)))
      .map((p) => p.section),
  )].sort();

  const oodBySection = {};
  const aoodAll = personnel.filter((p) => (p.role === 'AOOD') || (!p.role && AOOD_RANKS.includes(p.rank)));
  for (const p of personnel) {
    if ((p.role === 'OOD') || (!p.role && OOD_RANKS.includes(p.rank))) {
      (oodBySection[p.section] ||= []).push(p);
    }
  }

  const state = {
    assignedTotal: {},
    assignedWeekend: {},
    assignedHoliday: {},
  };
  const personDates = {}; // personId -> Set of dates stood
  const monthLoad = {}; // personId -> count
  const monthSpecial = {}; // personId -> special count
  const markDate = (id, date) => { (personDates[id] ||= new Set()).add(date); };

  const target = { year: calendar.year, month: calendar.month };
  const unassigned = [];

  // Result days keyed by date for two-pass assignment.
  const dayResults = {};
  for (const d of calendar.days) {
    dayResults[d.date] = {
      date: d.date,
      day: d.day,
      dow: d.dow,
      isWeekend: d.isWeekend,
      isHoliday: d.isHoliday,
      holiday: d.holiday,
      pool: d.date < mefCeStart ? 'MSB' : 'MEF_CE',
      ood: null,
      aood: null,
    };
  }

  // Order days so special slots are assigned first (best sections available).
  const orderedDays = [...calendar.days].sort((a, b) => {
    const rank = (x) => (x.isHoliday ? 0 : x.isWeekend ? 1 : 2);
    return rank(a) - rank(b) || a.date - b.date;
  });

  const recordOod = (res, section, person, day) => {
    res.ood = person ? toAssignment(person) : { name: '', section, phone: '' };
    state.assignedTotal[section] = (state.assignedTotal[section] || 0) + 1;
    if (day.isWeekend) state.assignedWeekend[section] = (state.assignedWeekend[section] || 0) + 1;
    if (day.isHoliday) state.assignedHoliday[section] = (state.assignedHoliday[section] || 0) + 1;
    if (person) {
      markDate(person.id, day.date);
      monthLoad[person.id] = (monthLoad[person.id] || 0) + 1;
      if (day.isWeekend || day.isHoliday) monthSpecial[person.id] = (monthSpecial[person.id] || 0) + 1;
    }
  };

  for (const day of orderedDays) {
    const res = dayResults[day.date];
    const isMsbDay = day.date < mefCeStart;

    if (isMsbDay && !fillMsb) continue; // leave blank for MSB to fill manually

    // ── Choose OOD section ──────────────────────────────────────────────
    const sectionPool = isMsbDay ? msbSections : mefSections;
    if (!sectionPool.length) {
      unassigned.push({ date: day.date, reason: 'no sections in pool' });
      continue;
    }
    const ranked = rankSections(sectionPool, day, burden, target, state);

    // Walk ranked sections until one yields an available individual.
    let chosenSection = null;
    let chosenPerson = null;
    for (const { section } of ranked) {
      const person = pickIndividual(oodBySection[section] || [], day, { role: 'OOD', personDates, monthLoad, monthSpecial });
      if (person) {
        chosenSection = section;
        chosenPerson = person;
        break;
      }
      if (!chosenSection) chosenSection = section; // remember first even if empty
    }
    if (!chosenPerson) {
      recordOod(res, chosenSection || sectionPool[0], null, day);
      unassigned.push({ date: day.date, role: 'OOD', reason: 'no eligible individual available' });
    } else {
      recordOod(res, chosenSection, chosenPerson, day);
    }

    // ── Choose AOOD ─────────────────────────────────────────────────────
    const oodCompany = res.ood?.section ? companyOf(res.ood.section) : null;
    let aoodCandidates = aoodAll;
    if (aoodPool === 'MSB') aoodCandidates = aoodCandidates.filter((p) => p.pool === 'MSB');
    // Cross-company preference: try the other company first.
    const preferred = aoodCandidates.filter((p) => companyOf(p.section) !== oodCompany);
    let aoodPerson = pickIndividual(preferred, day, { role: 'AOOD', personDates, monthLoad, monthSpecial });
    if (!aoodPerson) {
      aoodPerson = pickIndividual(aoodCandidates, day, { role: 'AOOD', personDates, monthLoad, monthSpecial });
    }
    if (aoodPerson) {
      res.aood = toAssignment(aoodPerson);
      markDate(aoodPerson.id, day.date);
      monthLoad[aoodPerson.id] = (monthLoad[aoodPerson.id] || 0) + 1;
      if (day.isWeekend || day.isHoliday) monthSpecial[aoodPerson.id] = (monthSpecial[aoodPerson.id] || 0) + 1;
    } else {
      res.aood = { name: '', section: '', phone: '' };
      unassigned.push({ date: day.date, role: 'AOOD', reason: 'no eligible AOOD available' });
    }
  }

  // ── Supernumerary (one per element) ─────────────────────────────────────
  const pickSuper = (filterFn) => {
    const cand = personnel.filter(filterFn);
    const least = [...cand].sort((a, b) => (monthLoad[a.id] || 0) - (monthLoad[b.id] || 0))[0];
    return least ? toAssignment(least) : { name: '', section: '', phone: '' };
  };
  const supernumerary = [
    { element: 'HQ', ...pickSuper((p) => p.section === 'HQ') },
    { element: 'CSSC', ...pickSuper((p) => p.section === 'CSSC') },
    { element: 'I MEF CE', ...pickSuper((p) => p.pool === 'MEF_CE') },
  ];

  const days = calendar.days.map((d) => dayResults[d.date]);
  return {
    year: calendar.year,
    month: calendar.month,
    monthName: calendar.monthName,
    label: calendar.label,
    mefCeStart,
    days,
    supernumerary,
    unassigned,
    config: { mefCeStart, fillMsb, aoodPool },
  };
}
