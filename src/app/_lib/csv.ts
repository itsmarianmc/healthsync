export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  // Spreadsheet programs may trim whitespace/control characters before
  // interpreting a cell. Prefix dangerous user strings with an apostrophe.
  const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(raw)
    ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
