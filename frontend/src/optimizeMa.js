import { buildSmaIndexCache } from "./ma.js";
import { simulateTrades, simulateTradesWithMaCache } from "./tradeSignals.js";

const FAST_MIN = 8;
const FAST_MAX = 30;
const SLOW_MIN = 30;
const SLOW_MAX = 100;
const GRID_STEP = 2;
const DAYS_1Y = 252;
const MIN_TRADES_3Y = 3;
const MIN_TRADES_1Y = 2;
const DEFAULT_TOP_N = 3;
const MA_TYPE = "sma";

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

function evaluateWindow(bars, fast, slow, minTrades, maCache, startIndex = 0) {
  const { trades } = maCache
    ? simulateTradesWithMaCache(bars, fast, slow, maCache, { startIndex })
    : simulateTrades(bars, fast, slow, MA_TYPE);
  const closed = trades.filter((t) => !t.open);
  if (closed.length < minTrades) return null;
  return { returnPct: closedTradeReturnPct(trades), trades: closed.length };
}

/**
 * Grid-search fast/slow SMA (step 2); rank by min(3y, 1y compounded return).
 */
export function optimizeMa(bars, { topN = DEFAULT_TOP_N } = {}) {
  if (!bars?.length) {
    return { top: [], baseline: null, totalPairs: 0, barCount: 0 };
  }

  const bars1yLen = Math.min(bars.length, DAYS_1Y);
  const bars1yStart = bars.length - bars1yLen;
  const maCache = buildSmaIndexCache(bars, FAST_MIN, SLOW_MAX);
  const results = [];

  for (let fast = FAST_MIN; fast <= FAST_MAX; fast += GRID_STEP) {
    for (let slow = SLOW_MIN; slow <= SLOW_MAX; slow += GRID_STEP) {
      if (slow <= fast) continue;

      const r3y = evaluateWindow(bars, fast, slow, MIN_TRADES_3Y, maCache);
      const r1y = evaluateWindow(
        bars,
        fast,
        slow,
        MIN_TRADES_1Y,
        maCache,
        bars1yStart
      );
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
