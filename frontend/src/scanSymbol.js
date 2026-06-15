import { optimizeMa } from "./optimizeMa.js";
import { simulateTrades } from "./tradeSignals.js";
import { createEntryAllowFn } from "./entryFilter.js";

const DEFAULT_OPT_MA = { fast: 21, slow: 50 };

function runningTotalFromTrades(trades) {
  let total = 0;
  for (const t of trades) {
    if (!t.open) {
      total += t.exitPrice - t.entryPrice;
    }
  }
  return total;
}

/** Compounded percent return from closed trades (same trades as runningTotal). */
function runningTotalPctFromTrades(trades) {
  const closed = trades.filter((t) => !t.open);
  if (!closed.length) return null;
  let factor = 1;
  for (const t of closed) {
    factor *= t.exitPrice / t.entryPrice;
  }
  return (factor - 1) * 100;
}

/**
 * Classify the most recent signal relative to the latest bar date.
 * entry / exit — signal on the last bar; open — in trade from an earlier bar.
 */
function classifyLastSignal(trades, markers, lastBarDate) {
  const onLast = markers.filter((m) => m.time === lastBarDate);
  if (onLast.some((m) => m.text === "Close")) {
    return { lastSignal: "exit", signalDate: lastBarDate };
  }
  if (onLast.some((m) => m.text === "Open")) {
    return { lastSignal: "entry", signalDate: lastBarDate };
  }

  const closedOnLast = trades.find((t) => !t.open && t.exitDate === lastBarDate);
  if (closedOnLast) {
    return { lastSignal: "exit", signalDate: lastBarDate };
  }

  const enteredOnLast = trades.find((t) => t.entryDate === lastBarDate);
  if (enteredOnLast && enteredOnLast.open) {
    return { lastSignal: "entry", signalDate: lastBarDate };
  }

  const openTrade = trades.find((t) => t.open);
  if (openTrade) {
    return { lastSignal: "open", signalDate: openTrade.entryDate };
  }

  return { lastSignal: "none", signalDate: null };
}

/**
 * Per-symbol scan: optimized MAs → rule opens/closes with optional regime + entry filter.
 */
export function scanSymbol(bars, { useEntryFilter = false, entryFilterModel = null } = {}) {
  if (!bars?.length) return null;

  const asOfDate = bars[bars.length - 1].date;
  const { top } = optimizeMa(bars);
  const best = top[0];
  const optUsedDefault = !best;
  const fast = best?.fast ?? DEFAULT_OPT_MA.fast;
  const slow = best?.slow ?? DEFAULT_OPT_MA.slow;

  const allowEntry = useEntryFilter
    ? createEntryAllowFn(entryFilterModel)
    : null;

  const { trades, markers } = simulateTrades(bars, fast, slow, "ema", {
    allowEntry,
  });
  const runningTotal = runningTotalFromTrades(trades);
  const runningTotalPct = runningTotalPctFromTrades(trades);
  const { lastSignal, signalDate } = classifyLastSignal(
    trades,
    markers,
    asOfDate
  );

  return {
    asOfDate,
    optFast: fast,
    optSlow: slow,
    optUsedDefault,
    optR3y: best?.r3y ?? null,
    optR1y: best?.r1y ?? null,
    optMinReturn: best?.minReturn ?? null,
    runningTotal,
    runningTotalPct,
    lastSignal,
    signalDate,
    barCount: bars.length,
  };
}
