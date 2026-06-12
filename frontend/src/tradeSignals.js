import { maByDate } from "./ma.js";

/** @typedef {'single' | 'double'} EntryConfirm */

export const ENTRY_CONFIRM = {
  SINGLE: "single",
  DOUBLE: "double",
};

/**
 * Entry: not in trade, close > slow MA, fast > slow, close > fast MA.
 * entryConfirm 'single' — one close above fast is enough.
 * entryConfirm 'double' — two consecutive closes above fast required.
 * Exit: in trade and close < fast MA.
 */
export function simulateTrades(
  bars,
  fastPeriod = 21,
  slowPeriod = 50,
  maType = "ema",
  { entryConfirm = ENTRY_CONFIRM.SINGLE } = {}
) {
  const requireDouble = entryConfirm === ENTRY_CONFIRM.DOUBLE;
  const maFast = maByDate(bars, fastPeriod, maType);
  const maSlow = maByDate(bars, slowPeriod, maType);
  const trades = [];
  const markers = [];
  let inTrade = false;
  let open = null;
  let consecutiveClosesAboveFast = 0;

  for (const bar of bars) {
    const eFast = maFast.get(bar.date);
    const eSlow = maSlow.get(bar.date);
    if (eFast == null || eSlow == null) continue;

    if (bar.close > eFast) {
      consecutiveClosesAboveFast += 1;
    } else {
      consecutiveClosesAboveFast = 0;
    }

    if (inTrade && bar.close < eFast) {
      inTrade = false;
      open.exitDate = bar.date;
      open.exitPrice = bar.close;
      trades.push(open);
      markers.push({
        time: bar.date,
        position: "aboveBar",
        shape: "arrowDown",
        color: "#ef5350",
        text: "Close",
      });
      open = null;
      consecutiveClosesAboveFast = 0;
    } else if (
      !inTrade &&
      bar.close > eSlow &&
      bar.close > eFast &&
      eFast > eSlow &&
      (!requireDouble || consecutiveClosesAboveFast >= 2)
    ) {
      inTrade = true;
      open = {
        entryDate: bar.date,
        entryPrice: bar.close,
      };
      markers.push({
        time: bar.date,
        position: "belowBar",
        shape: "arrowUp",
        color: "#6abf69",
        text: "Open",
      });
    }
  }

  if (inTrade && open) {
    trades.push({ ...open, open: true });
  }

  return { trades, markers };
}
