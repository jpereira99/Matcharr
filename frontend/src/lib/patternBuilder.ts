/** Replace the selected range in the pattern string with a placeholder token. */
export function replaceSelectionWithPlaceholder(
  pattern: string,
  selStart: number,
  selEnd: number,
  token: string,
): { ok: true; next: string; caret: number } | { ok: false; message: string } {
  const start = Math.max(0, Math.min(selStart, pattern.length));
  const end = Math.max(start, Math.min(selEnd, pattern.length));
  const selected = pattern.slice(start, end);
  if (!selected.trim()) {
    return { ok: false, message: "Select text in the pattern field, then tap a placeholder." };
  }
  const next = pattern.slice(0, start) + token + pattern.slice(end);
  return { ok: true, next, caret: start + token.length };
}
