/**
 * A URL-safe slug. Titles made entirely of characters outside [a-z0-9] —
 * non-Latin scripts, punctuation, emoji — would otherwise reduce to an empty
 * string, so they fall back to a fixed base that `uniqueSlug` can number.
 */
export function slugify(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

export async function uniqueSlug(title: string, exists: (slug: string) => Promise<boolean>) {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (await exists(slug)) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug;
}
