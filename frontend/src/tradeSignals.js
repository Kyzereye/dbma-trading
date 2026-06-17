import { maByDate } from "./ma.js";

/** @typedef {'single' | 'double'} EntryConfirm */

export const ENTRY_CONFIRM = {
  SINGLE: "single",
  DOUBLE: "double",
};

/**
 * Entry: not in trade, close > slow MA, fast > slow, close > fast MA.
 * Exit: in trade and close < fast MA.
 * Signals are evaluated at the bar close; fills use the next bar's open.
 */
export function simulateTrades(
  bars,
  fastPeriod = 21,
  slowPeriod = 50,
  maType = "sma",
  { entryConfirm = ENTRY_CONFIRM.SINGLE } = {}
) {
  const requireDouble = entryConfirm === ENTRY_CONFIRM.DOUBLE;
  const maFast = maByDate(bars, fastPeriod, maType);
  const maSlow = maByDate(bars, slowPeriod, maType);
  const trades = [];
  const markers = [];
  let inTrade = false;
  let open = null;
  let pendingEntry = false;
  let pendingExit = false;
  let consecutiveClosesAboveFast = 0;

  for (let barIndex = 0; barIndex < bars.length; barIndex++) {
    const bar = bars[barIndex];

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

    const eFast = maFast.get(bar.date);
    const eSlow = maSlow.get(bar.date);
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
      if (hasNextBar) {
        pendingExit = true;
      }
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
      if (hasNextBar) {
        pendingEntry = true;
      }
    }
  }

  if (inTrade && open) {
    trades.push({ ...open, open: true });
  }

  return { trades, markers };
}

/**
 * Same rules as simulateTrades; uses precomputed SMA arrays (bar index).
 */
export function simulateTradesWithMaCache(
  bars,
  fastPeriod,
  slowPeriod,
  maCache,
  { entryConfirm = ENTRY_CONFIRM.SINGLE, startIndex = 0 } = {}
) {
  const requireDouble = entryConfirm === ENTRY_CONFIRM.DOUBLE;
  const maFast = maCache.get(fastPeriod);
  const maSlow = maCache.get(slowPeriod);
  if (!maFast || !maSlow) {
    return { trades: [], markers: [] };
  }

  const trades = [];
  const markers = [];
  let inTrade = false;
  let open = null;
  let pendingEntry = false;
  let pendingExit = false;
  let consecutiveClosesAboveFast = 0;

  for (let barIndex = startIndex; barIndex < bars.length; barIndex++) {
    const bar = bars[barIndex];

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

    const eFast = maFast[barIndex];
    const eSlow = maSlow[barIndex];
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

  return { trades, markers };
}
