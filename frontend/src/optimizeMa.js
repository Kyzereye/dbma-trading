import { simulateTrades } from "./tradeSignals.js";

export const FAST_MIN = 8;
export const FAST_MAX = 30;
export const SLOW_MIN = 30;
export const SLOW_MAX = 100;
export const DAYS_1Y = 252;
export const MIN_TRADES_3Y = 3;
export const MIN_TRADES_1Y = 2;
export const DEFAULT_TOP_N = 3;

function sliceLastBars(bars, count) {
  if (bars.length <= count) return bars;
  return bars.slice(-count);
}

function closedTradeReturnPct(trades) {
  const closed = trades.filter((t) => !t.open);
  if (!closed.length) return null;
  let factor = 1;
  for (const t of closed) {
    factor *= t.exitPrice / t.entryPrice;
  }
  return (factor - 1) * 100;
}

function evaluateWindow(bars, fast, slow, minTrades) {
  const { trades } = simulateTrades(bars, fast, slow);
  const closed = trades.filter((t) => !t.open);
  if (closed.length < minTrades) return null;
  return { returnPct: closedTradeReturnPct(trades), trades: closed.length };
}

/**
 * Grid-search fast/slow EMA; rank by min(3y, 1y compounded return).
 */
export function optimizeMa(bars, { topN = DEFAULT_TOP_N } = {}) {
  if (!bars?.length) {
    return { top: [], baseline: null, totalPairs: 0, barCount: 0 };
  }

  const bars1y = sliceLastBars(bars, DAYS_1Y);
  const results = [];

  for (let fast = FAST_MIN; fast <= FAST_MAX; fast++) {
    for (let slow = SLOW_MIN; slow <= SLOW_MAX; slow++) {
      if (slow <= fast) continue;

      const r3y = evaluateWindow(bars, fast, slow, MIN_TRADES_3Y);
      const r1y = evaluateWindow(bars1y, fast, slow, MIN_TRADES_1Y);
      if (!r3y || !r1y) continue;

      results.push({
        fast,
        slow,
        r3y: r3y.returnPct,
        r1y: r1y.returnPct,
        minReturn: Math.min(r3y.returnPct, r1y.returnPct),
        n3y: r3y.trades,
        n1y: r1y.trades,
      });
    }
  }

  results.sort((a, b) => b.minReturn - a.minReturn);

  const baseline = results.find((r) => r.fast === 21 && r.slow === 50);
  const baselineRank = baseline ? results.indexOf(baseline) + 1 : null;

  return {
    top: results.slice(0, topN),
    baseline: baseline ? { ...baseline, rank: baselineRank } : null,
    totalPairs: results.length,
    barCount: bars.length,
    from: bars[0].date,
    to: bars[bars.length - 1].date,
  };
}

export function formatPct(v) {
  if (v == null) return "n/a";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}
