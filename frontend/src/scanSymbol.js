import { evaluateMaPair } from "./optimizeMa.js";
import {
  LOOKBACK_BARS,
  simulateTradesWalkForward,
} from "./walkForwardTrades.js";

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
 * Per-symbol scan: SMA grid on trailing 3y → walk-forward backtest for stats.
 */
export function scanSymbol(bars) {
  if (!bars?.length) return null;

  const asOfDate = bars[bars.length - 1].date;
  const { trades, markers, fast, slow } = simulateTradesWalkForward(bars, "sma");
  const lookback = bars.slice(Math.max(0, bars.length - LOOKBACK_BARS));
  const best = evaluateMaPair(lookback, fast, slow, "sma");
  const optUsedDefault = !best;
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
