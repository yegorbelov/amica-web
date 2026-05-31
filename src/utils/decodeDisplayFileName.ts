const PERCENT_ENCODING = /%[0-9A-Fa-f]{2}/;

/** Decode percent-encoded characters in filenames (e.g. %22 → "). */
export function decodeDisplayFileName(name?: string | null): string {
  if (!name) return '';
  if (!PERCENT_ENCODING.test(name)) return name;

  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
