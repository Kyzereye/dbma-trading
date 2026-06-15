/**
 * Train entry filter from historical rule-based trades (per-symbol optimized MAs).
 *
 *   npm run train-entry-filter
 *   npm run train-entry-filter -- --limit 200
 *   npm run train-entry-filter -- --symbol AAPL
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool } from "../backend/src/db.js";
import {
  listScannableSymbols,
  loadBarsForSymbol,
} from "../backend/src/scanData.js";
import { optimizeMa } from "../frontend/src/optimizeMa.js";
import { simulateTrades } from "../frontend/src/tradeSignals.js";
import { maByDate } from "../frontend/src/ma.js";
import {
  buildEntryFeatures,
  featureVector,
} from "../frontend/src/entryFeatures.js";
import { trainLogistic, predictWinProb } from "../frontend/src/entryFilter.js";
import { ENTRY_FILTER_MODEL_PATH } from "./entryFilterLoad.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function collectSamples(bars, fast, slow) {
  const maFast = maByDate(bars, fast, "ema");
  const maSlow = maByDate(bars, slow, "ema");
  const { trades } = simulateTrades(bars, fast, slow, "ema");
  const samples = [];

  for (const t of trades) {
    if (t.open) continue;
    const barIndex = bars.findIndex((b) => b.date === t.entryDate);
    if (barIndex < 0) continue;
    const eFast = maFast.get(t.entryDate);
    const eSlow = maSlow.get(t.entryDate);
    const features = buildEntryFeatures(bars, barIndex, eFast, eSlow, maSlow);
    if (!features) continue;
    const win = t.exitPrice > t.entryPrice ? 1 : 0;
    samples.push({ x: featureVector(features), y: win, date: t.entryDate });
  }

  return samples;
}

async function main() {
  const { symbol, limit } = parseArgs(process.argv);
  let symbols = symbol ? [symbol] : await listScannableSymbols();
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    symbols = symbols.slice(0, limit);
  }

  console.log(`Collecting entry samples from ${symbols.length} symbol(s)…\n`);

  const allSamples = [];
  for (const sym of symbols) {
    const bars = await loadBarsForSymbol(sym);
    if (bars.length < 60) continue;
    const { top } = optimizeMa(bars);
    const best = top[0];
    if (!best) continue;
    const samples = collectSamples(bars, best.fast, best.slow);
    if (samples.length > 0) {
      allSamples.push(...samples);
      console.log(
        `${sym.padEnd(8)} ${best.fast}/${best.slow}  ${samples.length} trade(s)`
      );
    }
  }

  if (allSamples.length < 50) {
    console.error(`\nToo few samples (${allSamples.length}). Need at least 50.`);
    process.exitCode = 1;
    return;
  }

  allSamples.sort((a, b) => a.date.localeCompare(b.date));
  const split = Math.floor(allSamples.length * 0.75);
  const trainSet = allSamples.slice(0, split);
  const testSet = allSamples.slice(split);

  const model = trainLogistic(trainSet);
  model.trainedAt = new Date().toISOString();
  model.sampleCount = allSamples.length;

  let testCorrect = 0;
  for (const s of testSet) {
    const features = {
      spreadPct: s.x[0],
      clearancePct: s.x[1],
      slowSlopePct: s.x[2],
      volRatio: s.x[3],
    };
    const p = predictWinProb(features, model);
    const pred = p >= model.threshold ? 1 : 0;
    if (pred === s.y) testCorrect++;
  }

  const winRate = allSamples.filter((s) => s.y === 1).length / allSamples.length;
  console.log(
    `\nSamples: ${allSamples.length}  baseline win rate: ${(winRate * 100).toFixed(1)}%`
  );
  console.log(
    `Holdout accuracy: ${testSet.length ? ((testCorrect / testSet.length) * 100).toFixed(1) : "n/a"}% (${testSet.length} trades)`
  );

  await mkdir(path.dirname(ENTRY_FILTER_MODEL_PATH), { recursive: true });
  await writeFile(ENTRY_FILTER_MODEL_PATH, `${JSON.stringify(model, null, 2)}\n`);
  console.log(`Wrote ${ENTRY_FILTER_MODEL_PATH}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
