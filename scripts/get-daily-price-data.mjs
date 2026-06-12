/**
 * Nightly: fetch new daily EOD from FMP since last bar → daily_stock_data.
 *
 *   npm run get-daily-price-data
 *   npm run get-daily-price-data -- --symbol AAPL,TSLA,BTCUSD
 *   npm run get-daily-price-data -- --no-cleanup
 */

import { closePool } from "../backend/src/db.js";
import {
  cleanupOldBars,
  getLatestBarDate,
  getSymbolId,
  HISTORY_YEARS,
  PRICE_DELAY_MS,
  resolveSymbolList,
  saveEodForSymbol,
  sleep,
  todayIso,
  yearsAgoIso,
  nextDayIso,
} from "./get-stock-data.mjs";
import { PRICE_DATA_LOG_REL, PriceRunLog } from "./price-run-log.mjs";

function parseDailyArgs(argv) {
  const args = argv.slice(2);
  let cleanup = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-cleanup") cleanup = false;
  }
  return { cleanup };
}

async function updateSymbol(symbol) {
  const today = todayIso();
  const symbolId = await getSymbolId(symbol);
  const latest = await getLatestBarDate(symbolId);
  const from = latest ? nextDayIso(latest) : yearsAgoIso(HISTORY_YEARS);

  if (from > today) {
    return { symbol, status: "current", count: 0 };
  }

  const r = await saveEodForSymbol(symbol, from, today);
  if (r.status === "empty") {
    return { symbol, status: "empty", count: 0 };
  }
  return r;
}

async function main() {
  const { cleanup } = parseDailyArgs(process.argv);
  const symbols = await resolveSymbolList(process.argv);
  const runLog = new PriceRunLog("daily");

  console.log(`Daily FMP EOD: ${symbols.length} symbols\n`);

  let ok = 0;
  let current = 0;
  let empty = 0;
  let failed = 0;
  let totalBars = 0;
  const t0 = Date.now();

  for (const sym of symbols) {
    try {
      const r = await updateSymbol(sym);
      totalBars += r.count || 0;
      if (r.status === "ok") {
        ok++;
        console.log(`${sym.padEnd(10)} +${r.count} bar(s)`);
      } else if (r.status === "current") {
        current++;
        console.log(`${sym.padEnd(10)} up to date`);
      } else {
        empty++;
        runLog.logEmpty(sym);
        console.log(`${sym.padEnd(10)} no new data`);
      }
    } catch (err) {
      failed++;
      runLog.logError(sym, err);
      console.error(`${sym.padEnd(10)} ERROR: ${err.message || err}`);
    }
    await sleep(PRICE_DELAY_MS);
  }

  await runLog.write();

  if (cleanup) {
    const deleted = await cleanupOldBars();
    console.log(`\nCleanup: removed ${deleted} row(s) older than ${HISTORY_YEARS}y`);
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nDone in ${sec}s — updated: ${ok}, up to date: ${current}, no data: ${empty}, failed: ${failed}, bars: ${totalBars}. Log: ${PRICE_DATA_LOG_REL}`
  );
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
