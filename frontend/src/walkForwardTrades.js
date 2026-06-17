import { optimizeMa } from "./optimizeMa.js";
import { ENTRY_CONFIRM } from "./tradeSignals.js";

export const DEFAULT_MA = { fast: 21, slow: 50 };
export const LOOKBACK_BARS = 252 * 3;
const MIN_BARS_FOR_OPT = 60;

function monthKey(date) {
  return String(date).slice(0, 7);
}

/** Rolling SMA; warm from bar 0 through barIndex when period changes. */
class RollingSma {
  constructor() {
    this.period = 0;
    this.buf = [];
    this.sum = 0;
    this.value = null;
  }

  warm(bars, barIndex, period) {
    this.period = period;
    this.buf = [];
    this.sum = 0;
    this.value = null;
    for (let i = 0; i <= barIndex; i++) {
      this.push(bars[i].close);
    }
    return this.value;
  }

  push(close) {
    if (this.period <= 0) return null;
    if (this.buf.length === this.period) {
      this.sum -= this.buf.shift();
    }
    this.buf.push(close);
    this.sum += close;
    if (this.buf.length < this.period) {
      this.value = null;
      return null;
    }
    this.value = this.sum / this.period;
    return this.value;
  }
}

/**
 * Rules + next-day open fills; fast/slow re-optimized at each month boundary
 * on trailing lookback (no lookahead).
 */
export function simulateTradesWalkForward(
  bars,
  maType = "sma",
  { entryConfirm = ENTRY_CONFIRM.SINGLE, lookbackBars = LOOKBACK_BARS } = {}
) {
  if (maType !== "sma") {
    throw new Error("simulateTradesWalkForward supports SMA only");
  }

  const requireDouble = entryConfirm === ENTRY_CONFIRM.DOUBLE;
  const trades = [];
  const markers = [];
  let inTrade = false;
  let open = null;
  let pendingEntry = false;
  let pendingExit = false;
  let consecutiveClosesAboveFast = 0;
  let fast = DEFAULT_MA.fast;
  let slow = DEFAULT_MA.slow;
  let currentMonth = null;
  let hasReoptimized = false;
  const fastMa = new RollingSma();
  const slowMa = new RollingSma();
  let monthJustStarted = true;

  for (let barIndex = 0; barIndex < bars.length; barIndex++) {
    const bar = bars[barIndex];
    const mk = monthKey(bar.date);

    if (mk !== currentMonth) {
      currentMonth = mk;
      monthJustStarted = true;

      if (barIndex > 0) {
        const end = barIndex - 1;
        const start = Math.max(0, end - lookbackBars + 1);
        const lookback = bars.slice(start, end + 1);
        if (lookback.length >= MIN_BARS_FOR_OPT) {
          const { top } = optimizeMa(lookback, {
            maType,
            topN: 1,
            anchor: hasReoptimized ? { fast, slow } : null,
          });
          hasReoptimized = true;
          if (top[0]) {
            fast = top[0].fast;
            slow = top[0].slow;
          }
        }
      }
    }

    let eFast;
    let eSlow;
    if (monthJustStarted) {
      eFast = fastMa.warm(bars, barIndex, fast);
      eSlow = slowMa.warm(bars, barIndex, slow);
      monthJustStarted = false;
    } else {
      eFast = fastMa.push(bar.close);
      eSlow = slowMa.push(bar.close);
    }

    if (pendingExit && inTrade && open) {
      open.exitDate = bar.date;
      open.exitPrice = bar.open;
      trades.push(open);
      inTrade = false;
      open = null;
    }
    pendingExit = false;

    if (pendingEntry && !inTrade) {
      inTrade = true;
      open = {
        entryDate: bar.date,
        entryPrice: bar.open,
      };
    }
    pendingEntry = false;

    if (eFast == null || eSlow == null) continue;

    if (bar.close > eFast) {
      consecutiveClosesAboveFast += 1;
    } else {
      consecutiveClosesAboveFast = 0;
    }

    const hasNextBar = barIndex < bars.length - 1;

    if (inTrade && bar.close < eFast) {
      markers.push({
        time: bar.date,
        position: "aboveBar",
        shape: "arrowDown",
        color: "#ef5350",
        text: "Close",
      });
      if (hasNextBar) pendingExit = true;
      consecutiveClosesAboveFast = 0;
    } else if (
      !inTrade &&
      bar.close > eSlow &&
      bar.close > eFast &&
      eFast > eSlow &&
      (!requireDouble || consecutiveClosesAboveFast >= 2)
    ) {
      markers.push({
        time: bar.date,
        position: "belowBar",
        shape: "arrowUp",
        color: "#6abf69",
        text: "Open",
      });
      if (hasNextBar) pendingEntry = true;
    }
  }

  if (inTrade && open) {
    trades.push({ ...open, open: true });
  }

  return { trades, markers, fast, slow };
}

/** Current pair from trailing lookback (scanner / API). */
export function optimizeMaCurrent(bars, maType = "sma") {
  if (!bars?.length) {
    return { fast: DEFAULT_MA.fast, slow: DEFAULT_MA.slow, usedDefault: true };
  }
  const start = Math.max(0, bars.length - LOOKBACK_BARS);
  const lookback = bars.slice(start);
  const { top } = optimizeMa(lookback, { maType, topN: 1 });
  const best = top[0];
  if (!best) {
    return { fast: DEFAULT_MA.fast, slow: DEFAULT_MA.slow, usedDefault: true };
  }
  return { fast: best.fast, slow: best.slow, usedDefault: false, best };
}
