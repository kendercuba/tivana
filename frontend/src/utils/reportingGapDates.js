/**
 * Calendar YYYY-MM-DD math (abstract dates, no clock semantics).
 * "Today" anchor uses America/Caracas for business reporting in Venezuela.
 */

export function addCalendarDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return x.toISOString().slice(0, 10);
}

export function caracasTodayYmd() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Caracas",
  });
}

export function caracasYesterdayYmd() {
  return addCalendarDaysYmd(caracasTodayYmd(), -1);
}

function ymdToUtcMs(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Counts inclusive calendar days from (maxYmd + 1) through targetEndYmd.
 * @returns {number|null} null if there is no max date yet (no imports).
 */
export function countMissingCalendarDaysToTarget(maxYmd, targetEndYmd) {
  if (!targetEndYmd) return 0;
  if (!maxYmd) return null;
  const start = addCalendarDaysYmd(maxYmd, 1);
  if (start > targetEndYmd) return 0;
  const spanMs = ymdToUtcMs(targetEndYmd) - ymdToUtcMs(start);
  return Math.round(spanMs / 86400000) + 1;
}
