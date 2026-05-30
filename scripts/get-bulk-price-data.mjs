/**
 * Bulk load ~HISTORY_YEARS of daily EOD from FMP → daily_stock_data.
 *
 *   npm run get-bulk-price-data
 *   npm run get-bulk-price-data -- --symbol AAPL,TSLA,BTCUSD
 *   npm run get-bulk-price-data -- --symbol AAPL, TSLA, EURUSD
 *   npm run get-bulk-price-data -- --limit 10
 */

import { closePool } from "../backend/src/db.js";
import {
  HISTORY_YEARS,
  PRICE_DELAY_MS,
  resolveSymbolList,
  saveEodForSymbol,
  sleep,
  todayIso,
  yearsAgoIso,
} from "./get-stock-data.mjs";

async function main() {
  const symbols = await resolveSymbolList(process.argv);
  const from = yearsAgoIso(HISTORY_YEARS);
  const to = todayIso();

  console.log(`Bulk FMP EOD: ${symbols.length} symbols, ${from} → ${to}\n`);

  let ok = 0;
  let empty = 0;
  let failed = 0;
  const t0 = Date.now();

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    try {
      const r = await saveEodForSymbol(sym, from, to);
      if (r.status === "ok") {
        ok++;
        console.log(
          `[${i + 1}/${symbols.length}] ${sym.padEnd(10)} ${r.count} bars (${r.from} → ${r.to})`
        );
      } else {
        empty++;
        console.log(`[${i + 1}/${symbols.length}] ${sym.padEnd(10)} no data`);
      }
    } catch (err) {
      failed++;
      console.error(
        `[${i + 1}/${symbols.length}] ${sym.padEnd(10)} ERROR: ${err.message || err}`
      );
    }
    await sleep(PRICE_DELAY_MS);
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${sec}s — ok: ${ok}, empty: ${empty}, failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
