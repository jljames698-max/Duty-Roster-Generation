// fairness.js — Burden tracking + fairness scoring for duty allocation.
//
// The duty "burden" we care about most is WEEKEND and HOLIDAY duty. The
// historical rosters are summarized per section and per month so the
// generator can:
//   1. Avoid giving the same section weekend/holiday duty in consecutive months.
//   2. Push special days toward sections with the lightest recent burden.
//   3. Keep total monthly duties roughly equal across sections.
//
// We attribute a day's burden to the OOD section (the directorate that owns
// the watch). AOOD support (historically HQ/CSSC) is tracked separately.

export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function blankStat() {
  return { total: 0, weekend: 0, holiday: 0 };
}

// Determine if a day record is a weekend. History records carry a `day`
// (e.g. "Sat"); fall back to that when no explicit flag is present.
function dayIsWeekend(d) {
  if (typeof d.isWeekend === 'boolean') return d.isWeekend;
  return d.day === 'Sat' || d.day === 'Sun';
}

function dayIsHoliday(d) {
  return !!(d.holiday && String(d.holiday).trim());
}

// Build the burden database from a list of roster objects.
// Each roster: { month, year, days: [{ oodSection, aoodSection, day, holiday, ... }] }
export function summarize(rosters) {
  const bySection = {};
  const byMonth = {}; // key -> { section -> stat }
  const monthsSet = new Set();

  const ensure = (section) => {
    if (!bySection[section]) {
      bySection[section] = { ...blankStat(), byMonth: {} };
    }
    return bySection[section];
  };

  for (const r of rosters) {
    const key = monthKey(r.year, r.month);
    monthsSet.add(key);
    if (!byMonth[key]) byMonth[key] = {};

    for (const d of r.days || []) {
      const sec = d.oodSection || d.ood?.section;
      if (!sec) continue;
      const weekend = dayIsWeekend(d);
      const holiday = dayIsHoliday(d);

      const s = ensure(sec);
      s.total += 1;
      if (weekend) s.weekend += 1;
      if (holiday) s.holiday += 1;

      if (!s.byMonth[key]) s.byMonth[key] = blankStat();
      s.byMonth[key].total += 1;
      if (weekend) s.byMonth[key].weekend += 1;
      if (holiday) s.byMonth[key].holiday += 1;

      if (!byMonth[key][sec]) byMonth[key][sec] = blankStat();
      byMonth[key][sec].total += 1;
      if (weekend) byMonth[key][sec].weekend += 1;
      if (holiday) byMonth[key][sec].holiday += 1;
    }
  }

  const months = [...monthsSet].sort();
  return { bySection, byMonth, months };
}

// The most recent roster month strictly before the target month.
export function priorMonthKey(burden, year, month) {
  const target = monthKey(year, month);
  const earlier = burden.months.filter((m) => m < target);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

// Per-section burden for a specific month key (zeros if none).
export function burdenForMonth(burden, key, section) {
  return burden.byMonth?.[key]?.[section] || blankStat();
}

// Weighted recent burden across the last N months (more recent = heavier).
function recentBurden(burden, section, beforeKey, n = 4) {
  const keys = burden.months.filter((m) => !beforeKey || m <= beforeKey).slice(-n);
  let weekend = 0;
  let holiday = 0;
  let total = 0;
  keys.forEach((k, i) => {
    const weight = i + 1; // older -> smaller weight
    const stat = burden.byMonth?.[k]?.[section] || blankStat();
    weekend += stat.weekend * weight;
    holiday += stat.holiday * weight;
    total += stat.total * weight;
  });
  return { weekend, holiday, total };
}

// Score a candidate section for a given day. LOWER score = better choice.
// `state` carries the in-progress allocation for the month being generated:
//   { assignedTotal: {sec:n}, assignedWeekend: {sec:n}, assignedHoliday: {sec:n} }
export function scoreSection(section, day, burden, target, state) {
  const prevKey = priorMonthKey(burden, target.year, target.month);
  const prev = prevKey ? burdenForMonth(burden, prevKey, section) : blankStat();
  const recent = recentBurden(burden, section, prevKey);

  const isWeekend = day.isWeekend;
  const isHoliday = day.isHoliday;
  const special = isWeekend || isHoliday;

  let score = 0;

  // 1. Balance total monthly load — strongly prefer sections used least so far.
  score += (state.assignedTotal[section] || 0) * 10;

  if (special) {
    // 2. Avoid consecutive-month special burden (the headline rule).
    if (isHoliday && prev.holiday > 0) score += 100;
    if (isWeekend && prev.weekend > 0) score += 60;
    // A section that carried ANY special last month is deprioritized.
    if (prev.weekend + prev.holiday > 0) score += 25;

    // 3. Don't pile multiple special days on one section this month.
    score += (state.assignedWeekend[section] || 0) * 40;
    score += (state.assignedHoliday[section] || 0) * 80;

    // 4. Prefer historically lighter sections for special days.
    score += recent.holiday * 6 + recent.weekend * 3;
  } else {
    // Weekdays: mostly just balance, light nudge from history.
    score += recent.total * 0.5;
  }

  return score;
}

// Produce an ordered list of sections (best first) for a single day.
export function rankSections(sections, day, burden, target, state) {
  return [...sections]
    .map((section) => ({ section, score: scoreSection(section, day, burden, target, state) }))
    .sort((a, b) => a.score - b.score || a.section.localeCompare(b.section));
}

// Grade a generated roster's fairness vs. history. Returns 0-100 + flags.
export function gradeRoster(generated, burden) {
  const prevKey = priorMonthKey(burden, generated.year, generated.month);
  const flags = [];
  let penalty = 0;

  // Count this month's special burden by section.
  const thisMonth = {};
  for (const d of generated.days) {
    const sec = d.ood?.section;
    if (!sec) continue;
    if (!thisMonth[sec]) thisMonth[sec] = blankStat();
    thisMonth[sec].total += 1;
    if (d.isWeekend) thisMonth[sec].weekend += 1;
    if (d.isHoliday) thisMonth[sec].holiday += 1;
  }

  for (const [sec, stat] of Object.entries(thisMonth)) {
    const prev = prevKey ? burdenForMonth(burden, prevKey, sec) : blankStat();
    if (stat.holiday > 0 && prev.holiday > 0) {
      penalty += 20;
      flags.push({ level: 'red', section: sec, msg: `${sec} carried holiday duty two months in a row.` });
    } else if (stat.weekend > 0 && prev.weekend > 0) {
      penalty += 10;
      flags.push({ level: 'yellow', section: sec, msg: `${sec} carried weekend duty two months in a row.` });
    }
  }

  // Penalize uneven distribution WITHIN the MEF CE pool only. HQ/CSSC are
  // expected to concentrate on the first-half window, so comparing them
  // against MEF CE directorates would not be a meaningful spread.
  const mefTotals = Object.entries(thisMonth)
    .filter(([sec]) => sec !== 'HQ' && sec !== 'CSSC')
    .map(([, s]) => s.total);
  if (mefTotals.length) {
    const spread = Math.max(...mefTotals) - Math.min(...mefTotals);
    if (spread > 2) {
      penalty += (spread - 2) * 5;
      flags.push({ level: 'yellow', section: '—', msg: `Uneven MEF CE load (spread of ${spread} duties).` });
    }
  }

  const score = Math.max(0, 100 - penalty);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { score, grade, flags, thisMonth };
}

// Identify sections that are "owed" a lighter month (heavy recent burden).
export function owedLighterMonths(burden, target) {
  const prevKey = priorMonthKey(burden, target.year, target.month);
  const out = [];
  for (const sec of Object.keys(burden.bySection)) {
    const prev = prevKey ? burdenForMonth(burden, prevKey, sec) : blankStat();
    if (prev.holiday > 0) out.push({ section: sec, reason: 'carried holiday last month', level: 'red' });
    else if (prev.weekend > 0) out.push({ section: sec, reason: 'carried weekend last month', level: 'yellow' });
  }
  return out;
}
