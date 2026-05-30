/**
 * Sync FMP symbol changes and delistings into stock_symbols.
 * Appends/updates data/symbol-changes.log (last 30 run days).
 *
 *   npm run sync-symbol-changes
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, getPool } from "../backend/src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SYMBOL_CHANGES_LOG_PATH = path.join(
  __dirname,
  "..",
  "data",
  "symbol-changes.log"
);

const FMP_BASE = "https://financialmodelingprep.com/stable";
const LOG_RETAIN_DAYS = 30;
const LOOKBACK_DAYS = 30;
const DELIST_PAGE_SIZE = 100;

function fmpKey() {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is missing in backend/.env");
  return key;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSymbol(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isWithinLookback(dateStr, cutoff) {
  const d = String(dateStr ?? "").slice(0, 10);
  return d.length === 10 && d >= cutoff;
}

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`FMP request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return JSON.parse(body);
}

async function fetchSymbolChanges() {
  const url = `${FMP_BASE}/symbol-change?apikey=${encodeURIComponent(fmpKey())}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) {
    throw new Error("FMP symbol-change: expected a JSON array");
  }
  return data;
}

async function fetchAllDelisted() {
  const rows = [];
  for (let page = 0; ; page++) {
    const url = `${FMP_BASE}/delisted-companies?page=${page}&limit=${DELIST_PAGE_SIZE}&apikey=${encodeURIComponent(fmpKey())}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < DELIST_PAGE_SIZE) break;
  }
  return rows;
}

async function getSymbolRow(symbol) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT symbol, company_name, asset_type, exchange, is_active
    FROM stock_symbols
    WHERE symbol = ?
    `,
    [symbol]
  );
  return rows[0] ?? null;
}

function isStockOrEtf(row) {
  return row && (row.asset_type === "stock" || row.asset_type === "etf");
}

async function applySymbolChange(oldSymbol, newSymbol, companyName) {
  const old = await getSymbolRow(oldSymbol);
  if (!isStockOrEtf(old)) return false;

  const existingNew = await getSymbolRow(newSymbol);
  if (existingNew?.is_active && !old.is_active) return false;
  if (!old.is_active && existingNew?.is_active) return false;

  const pool = getPool();
  await pool.execute(`UPDATE stock_symbols SET is_active = 0 WHERE symbol = ?`, [
    oldSymbol,
  ]);

  const name = String(companyName ?? existingNew?.company_name ?? old.company_name).trim();
  const exchange = existingNew?.exchange ?? old.exchange;

  await pool.execute(
    `
    INSERT INTO stock_symbols (symbol, company_name, asset_type, exchange, is_active)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      asset_type = VALUES(asset_type),
      exchange = VALUES(exchange),
      is_active = 1
    `,
    [newSymbol, name, old.asset_type, exchange]
  );

  return true;
}

async function applyDelist(symbol) {
  const row = await getSymbolRow(symbol);
  if (!isStockOrEtf(row) || !row.is_active) return false;

  const pool = getPool();
  await pool.execute(`UPDATE stock_symbols SET is_active = 0 WHERE symbol = ?`, [symbol]);
  return true;
}

function parseLog(text) {
  const entries = new Map();
  const blocks = text.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) continue;
    const date = lines[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    entries.set(date, lines.slice(1));
  }
  return entries;
}

function trimLogEntries(entries) {
  const dates = [...entries.keys()].sort();
  const cutoff = daysAgoIso(LOG_RETAIN_DAYS - 1);
  for (const date of dates) {
    if (date < cutoff) entries.delete(date);
  }
}

async function writeLog(runDate, eventLines) {
  await mkdir(path.dirname(SYMBOL_CHANGES_LOG_PATH), { recursive: true });

  let entries = new Map();
  try {
    const existing = await readFile(SYMBOL_CHANGES_LOG_PATH, "utf8");
    entries = parseLog(existing);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  entries.set(runDate, eventLines.length ? eventLines : ["No symbol changes."]);
  trimLogEntries(entries);

  const body = [...entries.keys()]
    .sort()
    .map((date) => `${date}\n${entries.get(date).join("\n")}`)
    .join("\n\n");

  await writeFile(SYMBOL_CHANGES_LOG_PATH, `${body}\n`, "utf8");
}

export async function syncSymbolChanges() {
  const runDate = todayIso();
  const cutoff = daysAgoIso(LOOKBACK_DAYS);
  const logLines = [];
  let changesApplied = 0;
  let delistsApplied = 0;

  console.log("Fetching FMP symbol changes…");
  const symbolChanges = await fetchSymbolChanges();

  const recentChanges = symbolChanges
    .map((row) => ({
      date: String(row.date ?? "").slice(0, 10),
      companyName: row.companyName,
      oldSymbol: normalizeSymbol(row.oldSymbol),
      newSymbol: normalizeSymbol(row.newSymbol),
    }))
    .filter(
      (row) =>
        row.oldSymbol &&
        row.newSymbol &&
        row.oldSymbol !== row.newSymbol &&
        isWithinLookback(row.date, cutoff)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.oldSymbol.localeCompare(b.oldSymbol));

  for (const row of recentChanges) {
    const applied = await applySymbolChange(row.oldSymbol, row.newSymbol, row.companyName);
    if (applied) {
      changesApplied++;
      logLines.push(`${row.date} ${row.oldSymbol} changed to ${row.newSymbol}`);
    }
  }

  console.log("Fetching FMP delisted companies…");
  const delisted = await fetchAllDelisted();

  const recentDelists = delisted
    .map((row) => ({
      symbol: normalizeSymbol(row.symbol),
      delistedDate: String(row.delistedDate ?? "").slice(0, 10),
    }))
    .filter(
      (row) => row.symbol && row.delistedDate && isWithinLookback(row.delistedDate, cutoff)
    )
    .sort((a, b) => a.delistedDate.localeCompare(b.delistedDate) || a.symbol.localeCompare(b.symbol));

  for (const row of recentDelists) {
    const applied = await applyDelist(row.symbol);
    if (applied) {
      delistsApplied++;
      logLines.push(`${row.delistedDate} ${row.symbol} is delisted`);
    }
  }

  await writeLog(runDate, logLines);

  return { runDate, changesApplied, delistsApplied, logLines };
}

async function main() {
  const { runDate, changesApplied, delistsApplied, logLines } = await syncSymbolChanges();

  if (logLines.length) {
    console.log(`\n${runDate}`);
    for (const line of logLines) console.log(line);
  } else {
    console.log(`\n${runDate}\nNo symbol changes.`);
  }

  console.log(
    `\nDone. Applied ${changesApplied} rename(s), ${delistsApplied} delist(s). Log: data/symbol-changes.log`
  );
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
