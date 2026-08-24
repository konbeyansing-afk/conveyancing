/**
 * Password rules. These are pure, so every branch is cheap to pin down here
 * rather than through the database-backed action tests.
 */

import { describe, expect, it } from "vitest";
import {
  generatePassword,
  passwordsMatch,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/password-policy";

const GOOD = "Kestrel-Parade-8842";

describe("validatePassword — accepts", () => {
  it("a long password using three character classes", () => {
    expect(validatePassword(GOOD)).toEqual({ ok: true });
  });

  it("a passphrase with spaces in the middle", () => {
    expect(validatePassword("correct horse Battery 9").ok).toBe(true);
  });

  it("exactly the minimum length", () => {
    // Deliberately non-repeating: a run of four identical characters is its own
    // rejection, which would otherwise mask the length check.
    const atMinimum = ("Ab3" + "cdefghijklmnop").slice(0, PASSWORD_MIN_LENGTH);
    expect(atMinimum).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(validatePassword(atMinimum).ok).toBe(true);
  });
});

describe("validatePassword — rejects", () => {
  const expectError = (password: string, pattern: RegExp) => {
    const result = validatePassword(password);
    expect(result.ok, `expected ${JSON.stringify(password)} to be rejected`).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  };

  it("an empty password", () => expectError("", /enter a new password/i));

  it("anything shorter than the minimum", () => {
    expectError(("Ab3" + "cdefghijklmnop").slice(0, PASSWORD_MIN_LENGTH - 1), /at least/i);
  });

  it("anything longer than the maximum", () => {
    const tooLong = "Aa1!" + "abcdefgh".repeat(Math.ceil(PASSWORD_MAX_LENGTH / 8));
    expect(tooLong.length).toBeGreaterThan(PASSWORD_MAX_LENGTH);
    expectError(tooLong, /or fewer/i);
  });

  it("the seeded default that shipped with the project", () => {
    expectError("ChangeMe123!", /too common/i);
  });

  it("other well-known passwords", () => {
    for (const password of ["Password123!", "Welcome123!", "1234567890"]) {
      const result = validatePassword(password);
      expect(result.ok, password).toBe(false);
    }
  });

  it("a password using only two character classes", () => {
    expectError("kestrelparade8842", /three of/i);
  });

  it("a password of one repeated character", () => {
    expectError("aaaaaaaaaaaaaaAA1", /four times in a row/i);
  });

  it("leading or trailing whitespace", () => {
    expectError(" Kestrel-Parade-8842", /space/i);
    expectError("Kestrel-Parade-8842 ", /space/i);
  });
});

describe("validatePassword — rejects passwords built from the user's own details", () => {
  it("one containing the email local part", () => {
    const result = validatePassword("shane.capati-99X!", {
      email: "shane.capati@example.test",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email/i);
  });

  it("one containing a part of the user's name", () => {
    const result = validatePassword("Capati-Winter-2026", { name: "Shane Capati" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/name/i);
  });

  it("but allows a short name fragment that would be noise", () => {
    // "Jo" is under the 4-character threshold, so it is not treated as a match.
    expect(validatePassword("Jonquil-Harbour-71", { name: "Jo Smith" }).ok).toBe(true);
  });

  it("one identical to the current password", () => {
    const result = validatePassword(GOOD, { currentPassword: GOOD });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/different/i);
  });
});

describe("passwordsMatch", () => {
  it("accepts an exact match", () => {
    expect(passwordsMatch(GOOD, GOOD)).toEqual({ ok: true });
  });

  it("rejects a mismatch", () => {
    const result = passwordsMatch(GOOD, GOOD + "x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/do not match/i);
  });

  it("rejects an empty confirmation", () => {
    const result = passwordsMatch(GOOD, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/confirm/i);
  });

  it("is case sensitive", () => {
    expect(passwordsMatch("Kestrel-1", "kestrel-1").ok).toBe(false);
  });
});

describe("generatePassword", () => {
  it("always satisfies the policy", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      expect(validatePassword(password).ok, password).toBe(true);
    }
  });

  it("does not repeat itself", () => {
    const generated = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(generated.size).toBe(50);
  });

  it("avoids characters that are easy to misread", () => {
    for (let i = 0; i < 25; i++) {
      expect(generatePassword()).not.toMatch(/[0OIl1]/);
    }
  });

  it("honours a requested length", () => {
    expect(generatePassword(32)).toHaveLength(32);
  });
});
