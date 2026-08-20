export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
