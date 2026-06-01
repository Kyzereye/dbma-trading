/**
 * Strip exchange-style suffixes from company / security names before DB storage.
 * Add patterns here as new noisy suffixes show up in source feeds.
 */
const COMPANY_NAME_SUFFIX_PATTERNS = [
  /\s*-\s*Class\s+[A-Z]\s+Common Stock\s*$/i,
  /\s*-\s*Common Stock\s*$/i,
  /\s+Common Stock\s*$/i,
];

export function normalizeCompanyName(name) {
  let s = String(name ?? "").trim();
  if (!s) return s;

  for (const pattern of COMPANY_NAME_SUFFIX_PATTERNS) {
    s = s.replace(pattern, "").trim();
  }

  return s;
}
