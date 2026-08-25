/**
 * Date engine for the settlement calculator.
 *
 * Convention (stated once, here, and nowhere else): calendar-period day
 * counts — assessment periods, levy periods, rent periods — are INCLUSIVE on
 * both ends. `daysInclusive("2026-07-01", "2026-07-01")` is `1`, matching
 * "the seller owns settlement day itself." Meter-read spans and any other
 * elapsed-time measurement between two point-in-time readings are EXCLUSIVE
 * — `daysExclusive` measures the gap between two readings, not a period
 * anyone owns. Every adjustment module must use the correct one; this file
 * is the only place either is implemented.
 *
 * All dates are plain ISO strings (`yyyy-mm-dd`), parsed at UTC midnight so
 * arithmetic is never affected by the runtime's local timezone or DST.
 */

/** An ISO date string, `yyyy-mm-dd`. */
export type IsoDate = string;

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isValidIsoDate(iso: string | null | undefined): iso is IsoDate {
  if (!iso) return false;
  if (!ISO_PATTERN.test(iso)) return false;
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return false;
  // Date.UTC silently rolls an out-of-range day into the next month (e.g. Feb
  // 30 -> Mar 2) instead of throwing, which would otherwise let a typo'd
  // assessment date silently become a different, wrong date. Reject anything
  // that doesn't round-trip back to the exact input.
  const [y, m, day] = iso.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
}

/** Inclusive day count from a to b (b − a + 1). Negative if b is before a. */
export function daysInclusive(a: IsoDate, b: IsoDate): number {
  return daysExclusive(a, b) + 1;
}

/** Plain elapsed days between two dates (b − a), with no +1. */
export function daysExclusive(a: IsoDate, b: IsoDate): number {
  const da = parseIsoDate(a);
  const db = parseIsoDate(b);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** The number of days in the calendar month that `iso` falls in. */
export function daysInMonthOf(iso: IsoDate): number {
  const d = parseIsoDate(iso);
  return daysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function formatAuDate(iso: IsoDate | null): string {
  if (!isValidIsoDate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Formats an ISO date as "3 October 2026", for the settlement statement and calculation trail. */
export function formatLongAuDate(iso: IsoDate | null): string {
  if (!isValidIsoDate(iso)) return "—";
  const d = parseIsoDate(iso);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
