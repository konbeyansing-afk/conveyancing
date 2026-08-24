/**
 * Password rules, in one place so the sign-up form, the self-service change
 * form and the admin reset all agree.
 *
 * Pure functions — no I/O, no session — so they are cheap to test exhaustively
 * and can run on the server without pulling in Prisma or Auth.js.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Passwords this codebase has shipped or documented at some point, plus the
 * usual suspects. Rejected outright regardless of how well they otherwise
 * score — the seeded default in particular must never survive a change.
 */
const BANNED_PASSWORDS = new Set(
  [
    "ChangeMe123!",
    "Password123!",
    "Password1234",
    "Welcome123!",
    "Conveyancing1",
    "ConveyancingAcademy",
    "administrator",
    "password",
    "passw0rd",
    "qwertyuiop",
    "12345678",
    "123456789",
    "1234567890",
    "letmein123",
    "iloveyou123",
  ].map((p) => p.toLowerCase()),
);

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/** Characters repeated four or more times in a row, e.g. "aaaa". */
const RUN_OF_FOUR = /(.)\1{3,}/;

/**
 * Validates a candidate password.
 *
 * `context` lets the rules reject passwords built out of the user's own
 * details, which are the first thing anyone guesses.
 */
export function validatePassword(
  password: string,
  context: { name?: string; email?: string; currentPassword?: string } = {},
): PasswordCheck {
  if (!password) return { ok: false, error: "Enter a new password." };

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (password.trim() !== password) {
    return { ok: false, error: "Password cannot start or end with a space." };
  }

  const lower = password.toLowerCase();

  if (BANNED_PASSWORDS.has(lower)) {
    return { ok: false, error: "That password is too common. Choose something else." };
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password));
  if (classes.length < 3) {
    return {
      ok: false,
      error:
        "Password must use at least three of: lower case, upper case, numbers, symbols.",
    };
  }

  if (RUN_OF_FOUR.test(password)) {
    return { ok: false, error: "Password cannot repeat the same character four times in a row." };
  }

  if (context.currentPassword && password === context.currentPassword) {
    return { ok: false, error: "New password must be different from the current one." };
  }

  const emailLocalPart = context.email?.split("@")[0]?.toLowerCase();
  if (emailLocalPart && emailLocalPart.length >= 4 && lower.includes(emailLocalPart)) {
    return { ok: false, error: "Password cannot contain your email address." };
  }

  if (context.name) {
    const namePart = context.name
      .split(/\s+/)
      .map((part) => part.toLowerCase())
      .find((part) => part.length >= 4 && lower.includes(part));
    if (namePart) return { ok: false, error: "Password cannot contain your name." };
  }

  return { ok: true };
}

/** Checks the new password against its confirmation field. */
export function passwordsMatch(password: string, confirmation: string): PasswordCheck {
  if (!confirmation) return { ok: false, error: "Confirm your new password." };
  if (password !== confirmation) return { ok: false, error: "The two passwords do not match." };
  return { ok: true };
}

/**
 * A cryptographically random password, for seeding an admin account or an
 * admin-issued reset. Deliberately built from an unambiguous alphabet so it can
 * be read out or typed without confusing 0/O or 1/l.
 */
export function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];

  // Regenerate rather than return something the policy would reject.
  return validatePassword(out).ok ? out : generatePassword(length);
}
