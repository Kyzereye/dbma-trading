import { optimizeMa } from "./optimizeMa.js";
import { simulateTrades } from "./tradeSignals.js";

export const DEFAULT_OPT_MA = { fast: 21, slow: 50 };

export function runningTotalFromTrades(trades) {
  let total = 0;
  for (const t of trades) {
    if (!t.open) {
      total += t.exitPrice - t.entryPrice;
    }
  }
  return total;
}

/**
 * Classify the most recent signal relative to the latest bar date.
 * entry / exit — signal on the last bar; open — in trade from an earlier bar.
 */
export function classifyLastSignal(trades, markers, lastBarDate) {
  const onLast = markers.filter((m) => m.time === lastBarDate);
  if (onLast.some((m) => m.text === "Exit")) {
    return { lastSignal: "exit", signalDate: lastBarDate };
  }
  if (onLast.some((m) => m.text === "Entry")) {
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
 * Run per-symbol nightly scan: optimized EMA pair + trades + signals.
 */
export function scanSymbol(bars) {
  if (!bars?.length) return null;

  const asOfDate = bars[bars.length - 1].date;
  const { top } = optimizeMa(bars);
  const best = top[0];
  const optUsedDefault = !best;
  const fast = best?.fast ?? DEFAULT_OPT_MA.fast;
  const slow = best?.slow ?? DEFAULT_OPT_MA.slow;

  const { trades, markers } = simulateTrades(bars, fast, slow, "ema");
  const runningTotal = runningTotalFromTrades(trades);
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
    lastSignal,
    signalDate,
    barCount: bars.length,
  };
}
