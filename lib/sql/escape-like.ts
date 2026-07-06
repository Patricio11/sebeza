/**
 * Phase 26.6 (security audit)  escape LIKE/ILIKE metacharacters in user-
 * supplied search strings before wrapping them in %…%. Without this, a user
 * typing `%` or `_` matches over-broadly (a mild scan/DoS vector on admin +
 * gov search). Values are already bound parameters  this is about pattern
 * semantics, not injection.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
