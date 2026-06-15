/** Rolling average volume ending at bar index i (inclusive). */
export function avgVolume(bars, i, period = 20) {
  if (i < period - 1) return null;
  let sum = 0;
  for (let j = i - period + 1; j <= i; j++) {
    sum += Number(bars[j].volume) || 0;
  }
  return sum / period;
}

/**
 * Features at a bar for regime gate / entry filter (price, MAs, volume only).
 */
export function buildEntryFeatures(bars, barIndex, eFast, eSlow, maSlow) {
  const bar = bars[barIndex];
  const close = bar.close;
  if (!close || !eFast || !eSlow) return null;

  const spreadPct = ((eFast - eSlow) / close) * 100;
  const clearancePct = ((close - eFast) / close) * 100;

  let slowSlopePct = 0;
  if (barIndex >= 5) {
    const prevDate = bars[barIndex - 5].date;
    const slowPrev = maSlow.get(prevDate);
    if (slowPrev) {
      slowSlopePct = ((eSlow - slowPrev) / eSlow) * 100;
    }
  }

  const volAvg = avgVolume(bars, barIndex);
  const vol = Number(bar.volume) || 0;
  const volRatio = volAvg && volAvg > 0 ? vol / volAvg : null;

  return { spreadPct, clearancePct, slowSlopePct, volRatio };
}

export const FEATURE_NAMES = [
  "spreadPct",
  "clearancePct",
  "slowSlopePct",
  "volRatio",
];

export function featureVector(features) {
  return FEATURE_NAMES.map((k) => {
    const v = features[k];
    return v == null || !Number.isFinite(v) ? 0 : v;
  });
}
