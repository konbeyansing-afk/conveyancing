/**
 * Integer-cents money arithmetic for the settlement calculator.
 *
 * Every dollar figure in this feature is stored and computed as an integer
 * number of cents — never a floating-point dollar amount. `dollarsToCents` is
 * the single rounding boundary in the whole engine: it runs exactly once,
 * when a user's typed dollar string is committed. Every function downstream
 * of that (addCents, subtractCents, multiplyCentsByRatio) works on integers,
 * so no float-drift rounding error (`195.649999999...`) is possible no
 * matter how many operations a figure passes through.
 */

/** An integer number of cents. Always `Number.isInteger(x) === true`. */
export type Cents = number;

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + v, 0);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return a - b;
}

export function negateCents(a: Cents): Cents {
  return -a;
}

/**
 * `cents * (numerator / denominator)`, rounded once at the end. Used for
 * proration (e.g. `amountCents * sellerDays / periodDays`) — never compute a
 * rounded intermediate rate and multiply that, which is how rounding error
 * compounds across a chain of calculations.
 */
export function multiplyCentsByRatio(cents: Cents, numerator: number, denominator: number): Cents {
  if (denominator === 0) return 0;
  return Math.round((cents * numerator) / denominator);
}

export function formatAUD(cents: Cents | null): string {
  if (cents === null) return "—";
  return centsToDollars(cents).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

/** Formats without the currency symbol, for use inside a currency `<input>` on blur. */
export function formatDollarsPlain(cents: Cents | null): string {
  if (cents === null) return "";
  return centsToDollars(cents).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function isNonNegative(cents: Cents): boolean {
  return cents >= 0;
}

/**
 * Parses a plain (unformatted or comma-formatted) dollar string typed by a
 * user into cents, or `null` if it isn't a valid non-negative amount yet
 * (including while still mid-typing, e.g. a lone "-" or trailing ".").
 */
export function parseDollarStringToCents(raw: string): Cents | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return dollarsToCents(parsed);
}
