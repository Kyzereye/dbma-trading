/**
 * Log empty/failed symbol fetches from get-bulk-price-data and get-daily-price-data.
 * Output: data/price-data.log (last 30 run days).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PRICE_DATA_LOG_PATH = path.join(__dirname, "..", "data", "price-data.log");
export const PRICE_DATA_LOG_REL = "data/price-data.log";

const RETAIN_DAYS = 30;
const NO_ISSUES_LINE = "No failures or empty responses.";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function runKey(runDate, job) {
  return `${runDate} ${job}`;
}

function entryDate(key) {
  return String(key).slice(0, 10);
}

function parseLog(text) {
  const entries = new Map();
  for (const block of text.trim().split(/\n\n+/)) {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) continue;
    entries.set(lines[0], lines.slice(1));
  }
  return entries;
}

function trimEntries(entries) {
  const cutoff = daysAgoIso(RETAIN_DAYS - 1);
  for (const key of [...entries.keys()]) {
    if (entryDate(key) < cutoff) entries.delete(key);
  }
}

async function writeLogFile(runKeyStr, eventLines) {
  await mkdir(path.dirname(PRICE_DATA_LOG_PATH), { recursive: true });

  let entries = new Map();
  try {
    entries = parseLog(await readFile(PRICE_DATA_LOG_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  entries.set(runKeyStr, eventLines.length ? eventLines : [NO_ISSUES_LINE]);
  trimEntries(entries);

  const body = [...entries.keys()]
    .sort()
    .map((key) => `${key}\n${entries.get(key).join("\n")}`)
    .join("\n\n");

  await writeFile(PRICE_DATA_LOG_PATH, `${body}\n`, "utf8");
}

/** Collect and write bulk/daily price ingest issues. */
export class PriceRunLog {
  /** @param {"bulk" | "daily"} job */
  constructor(job) {
    this.job = job;
    this.lines = [];
  }

  logEmpty(symbol) {
    this.lines.push(`${symbol} no data`);
  }

  logError(symbol, err) {
    const msg = err?.message || String(err);
    this.lines.push(`${symbol} ERROR: ${msg}`);
  }

  async write() {
    await writeLogFile(runKey(todayIso(), this.job), this.lines);
  }
}
