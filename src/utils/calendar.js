// calendar.js — Date / holiday calculations for the duty roster.
// Pure functions; holiday data is passed in so this module works in both
// the browser (Vite JSON import) and Node (fs read).

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month) {
  return MONTH_NAMES[month - 1];
}

export function daysInMonth(year, month) {
  // month is 1-based
  return new Date(year, month, 0).getDate();
}

// Parse an ISO-ish "YYYY-MM-DDTHH:mm:ss" string as a LOCAL date.
// We intentionally avoid the Z/UTC interpretation so liberty windows line
// up with the calendar day a Marine actually stands duty.
function parseLocal(str) {
  const [datePart, timePart = '00:00:00'] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}

// Return the holiday label that applies to a given calendar date (1-based
// month) if that date falls within any holiday's special-liberty window.
// A date "falls within" the window if any part of that calendar day overlaps
// the [liberty_starts, liberty_ends) interval.
export function holidayLabelFor(year, month, date, holidays) {
  const dayStart = new Date(year, month - 1, date, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, date, 23, 59, 59);
  for (const h of holidays) {
    const start = parseLocal(h.liberty_starts);
    const end = parseLocal(h.liberty_ends);
    if (dayStart <= end && dayEnd >= start) {
      return h.label;
    }
  }
  return '';
}

export function isWeekend(year, month, date) {
  const dow = new Date(year, month - 1, date).getDay();
  return dow === 0 || dow === 6;
}

// Build a full calendar for the month: one entry per day with metadata and
// which pool (MSB organic vs MEF CE) owns that date.
export function buildCalendar(year, month, holidays, mefCeStart = 16) {
  const n = daysInMonth(year, month);
  const days = [];
  for (let date = 1; date <= n; date++) {
    const dow = new Date(year, month - 1, date).getDay();
    const label = holidayLabelFor(year, month, date, holidays);
    days.push({
      date,
      dow,
      day: DAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
      holiday: label,
      isHoliday: !!label,
      pool: date < mefCeStart ? 'MSB' : 'MEF_CE',
    });
  }
  return {
    year,
    month,
    monthName: monthName(month),
    label: `${monthName(month)} ${year}`,
    mefCeStart,
    daysInMonth: n,
    days,
  };
}

export { DAY_NAMES, MONTH_NAMES };
