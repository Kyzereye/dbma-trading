export const DEFAULT_REGIME = {
  minSpreadPct: 0.3,
  minSlowSlopePct: 0,
  minVolRatio: 0.5,
};

/** Skip chop: need MA separation, slow MA rising, and reasonable volume. */
export function passesRegimeGate(features, opts = DEFAULT_REGIME) {
  if (!features) return false;
  if (features.spreadPct < opts.minSpreadPct) return false;
  if (features.slowSlopePct < opts.minSlowSlopePct) return false;
  if (
    features.volRatio != null &&
    features.volRatio < opts.minVolRatio
  ) {
    return false;
  }
  return true;
}
