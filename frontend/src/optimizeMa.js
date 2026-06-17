import { buildSmaIndexCache } from "./ma.js";
import { simulateTrades, simulateTradesWithMaCache } from "./tradeSignals.js";

export const FAST_MIN = 8;
export const FAST_MAX = 30;
export const SLOW_MIN = 30;
export const SLOW_MAX = 100;
export const GRID_STEP = 2;
export const REFINE_RADIUS = 8;

const DAYS_1Y = 252;
const MIN_TRADES_3Y = 2;
const MIN_TRADES_1Y = 1;
const DEFAULT_MA_TYPE = "sma";
const DEFAULT_TOP_N = 3;

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

function perTradeStats(trades) {
  const closed = trades.filter((t) => !t.open);
  if (!closed.length) return null;
  let sumPct = 0;
  let wins = 0;
  for (const t of closed) {
    const pct = (t.exitPrice / t.entryPrice - 1) * 100;
    sumPct += pct;
    if (pct > 0) wins += 1;
  }
  return {
    count: closed.length,
    avgTradePct: sumPct / closed.length,
    winRate: wins / closed.length,
  };
}

/** Penalize very active pairs and hard-to-trust edge periods (chop proxy). */
function chopPenalty(fast, slow, n3y) {
  let p = 0;
  if (n3y > 18) p += (n3y - 18) * 0.2;
  if (fast === FAST_MIN && slow <= SLOW_MIN + 2) p += 2;
  if (fast >= FAST_MAX - 1 && slow >= SLOW_MAX - 5) p += 1.5;
  return p;
}

/** Profit-focused score: compounded return + avg trade quality − chop penalty. */
function pairScore(minReturn, avgTradePct) {
  return minReturn + 0.3 * avgTradePct;
}

function* rangeValues(min, max, step) {
  for (let v = min; v <= max; v += step) yield v;
}

/**
 * Full grid (step 2) or local refine around anchor — MAs rarely jump far month to month.
 */
export function generatePairGrid({
  step = GRID_STEP,
  anchor = null,
  refineRadius = REFINE_RADIUS,
} = {}) {
  const pairs = [];

  if (!anchor) {
    for (const fast of rangeValues(FAST_MIN, FAST_MAX, step)) {
      for (const slow of rangeValues(SLOW_MIN, SLOW_MAX, step)) {
        if (slow > fast) pairs.push({ fast, slow });
      }
    }
    return pairs;
  }

  const seen = new Set();
  const fLo = Math.max(FAST_MIN, anchor.fast - refineRadius);
  const fHi = Math.min(FAST_MAX, anchor.fast + refineRadius);
  const sLo = Math.max(SLOW_MIN, anchor.slow - refineRadius);
  const sHi = Math.min(SLOW_MAX, anchor.slow + refineRadius);

  for (const fast of rangeValues(fLo, fHi, step)) {
    for (const slow of rangeValues(sLo, sHi, step)) {
      if (slow <= fast) continue;
      const key = `${fast},${slow}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ fast, slow });
    }
  }

  return pairs;
}

function evaluateWindow(bars, fast, slow, minTrades, maType, maCache, startIndex = 0) {
  const { trades } = maCache
    ? simulateTradesWithMaCache(bars, fast, slow, maCache, { startIndex })
    : simulateTrades(bars, fast, slow, maType);
  const stats = perTradeStats(trades);
  if (!stats || stats.count < minTrades) return null;
  return {
    returnPct: closedTradeReturnPct(trades),
    trades: stats.count,
    avgTradePct: stats.avgTradePct,
    winRate: stats.winRate,
  };
}

function buildPairResult(fast, slow, r3y, r1y) {
  const minReturn = Math.min(r3y.returnPct, r1y.returnPct);
  const score =
    pairScore(minReturn, r3y.avgTradePct) -
    chopPenalty(fast, slow, r3y.trades);
  return {
    fast,
    slow,
    r3y: r3y.returnPct,
    r1y: r1y.returnPct,
    minReturn,
    score,
    avgTradePct: r3y.avgTradePct,
    winRate: r3y.winRate,
    n3y: r3y.trades,
    n1y: r1y.trades,
  };
}

/**
 * Grid-search fast/slow; rank by profit score (return + per-trade quality − chop).
 * anchor: refine ±REFINE_RADIUS (step 2) around prior pair; omit for full grid.
 */
export function optimizeMa(
  bars,
  {
    topN = DEFAULT_TOP_N,
    maType = DEFAULT_MA_TYPE,
    step = GRID_STEP,
    anchor = null,
    refineRadius = REFINE_RADIUS,
  } = {}
) {
  if (!bars?.length) {
    return { top: [], baseline: null, totalPairs: 0, barCount: 0 };
  }

  const pairs = generatePairGrid({ step, anchor, refineRadius });
  const bars1yLen = Math.min(bars.length, DAYS_1Y);
  const bars1yStart = bars.length - bars1yLen;

  const maCache =
    maType === "sma"
      ? buildSmaIndexCache(bars, FAST_MIN, SLOW_MAX)
      : null;

  const results = [];

  for (const { fast, slow } of pairs) {
    const r3y = evaluateWindow(
      bars,
      fast,
      slow,
      MIN_TRADES_3Y,
      maType,
      maCache
    );
    const r1y = evaluateWindow(
      bars,
      fast,
      slow,
      MIN_TRADES_1Y,
      maType,
      maCache,
      bars1yStart
    );
    if (!r3y || !r1y) continue;

    results.push(buildPairResult(fast, slow, r3y, r1y));
  }

  results.sort((a, b) => b.score - a.score);

  const baseline = results.find((r) => r.fast === 21 && r.slow === 50);
  const baselineRank = baseline ? results.indexOf(baseline) + 1 : null;

  return {
    top: results.slice(0, topN),
    baseline: baseline ? { ...baseline, rank: baselineRank } : null,
    totalPairs: pairs.length,
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
