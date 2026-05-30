/**
 * Nightly scan: optimize MA per symbol, detect entry/exit, store running totals.
 *
 *   npm run scan:nightly
 *   npm run scan:nightly -- --symbol AAPL   (single symbol)
 *   npm run scan:nightly -- --limit 10      (first N symbols, for testing)
 */

import { scanSymbol } from "../frontend/src/scanSymbol.js";
import { closePool } from "../backend/src/db.js";
import {
  listScannableSymbols,
  loadBarsForSymbol,
  upsertScanRow,
} from "../backend/src/scanData.js";

const DELAY_MS = Number(process.env.SCAN_DELAY_MS) || 0;

function parseArgs(argv) {
  const args = argv.slice(2);
  let symbol = null;
  let limit = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--symbol" && args[i + 1]) {
      symbol = args[++i].toUpperCase();
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = Number(args[++i]);
    }
  }
  return { symbol, limit };
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

async function scanOne(sym) {
  const bars = await loadBarsForSymbol(sym);
  if (!bars.length) {
    return { sym, status: "skip", reason: "no bars" };
  }
  const result = scanSymbol(bars);
  if (!result) {
    return { sym, status: "skip", reason: "scan failed" };
  }
  await upsertScanRow(sym, result);
  return { sym, status: "ok", ...result };
}

async function main() {
  const { symbol, limit } = parseArgs(process.argv);

  let symbols = symbol ? [symbol] : await listScannableSymbols();
  if (!symbols.length) {
    console.error(
      "No scannable symbols (active stock/etf rows in stock_symbols)."
    );
    process.exitCode = 1;
    return;
  }
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    symbols = symbols.slice(0, limit);
  }

  console.log(
    `Scanning ${symbols.length} active stock/ETF symbol(s) (requires daily_stock_data)…\n`
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const t0 = Date.now();

  for (const sym of symbols) {
    try {
      const r = await scanOne(sym);
      if (r.status === "ok") {
        ok++;
        const sig =
          r.lastSignal === "none"
            ? "—"
            : `${r.lastSignal}@${r.signalDate || r.asOfDate}`;
        console.log(
          `${sym.padEnd(6)} ${r.optFast}/${r.optSlow}  RT ${r.runningTotal >= 0 ? "+" : ""}${r.runningTotal.toFixed(2)}  ${sig}`
        );
      } else {
        skipped++;
        console.log(`${sym.padEnd(6)} skipped (${r.reason})`);
      }
    } catch (err) {
      failed++;
      console.error(`${sym.padEnd(6)} ERROR: ${err.message || err}`);
    }
    await sleep(DELAY_MS);
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nDone in ${sec}s — ok: ${ok}, skipped: ${skipped}, failed: ${failed}`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
