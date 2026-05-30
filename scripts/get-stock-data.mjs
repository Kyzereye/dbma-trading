/**
 * Shared FMP EOD fetch + daily_stock_data helpers.
 * Used by get-bulk-price-data.mjs and get-daily-price-data.mjs.
 */

import { getPool } from "../backend/src/db.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
export const HISTORY_YEARS = Number(process.env.HISTORY_YEARS) || 3;
export const PRICE_DELAY_MS =
  Number(process.env.FMP_PRICE_DELAY_MS) ||
  Number(process.env.INGEST_DELAY_MS) ||
  300;

function fmpKey() {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is missing in backend/.env");
  return key;
}

function toDateString(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function normalizeBar(row) {
  return {
    date: toDateString(row.date),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number.parseInt(String(row.volume), 10) || 0,
  };
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function yearsAgoIso(years = HISTORY_YEARS) {
  const y = Math.max(1, Math.min(50, Math.floor(years)));
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
}

export function nextDayIso(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Active symbols in stock_symbols (all asset types). */
export async function listSymbols() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT symbol FROM stock_symbols WHERE is_active = 1 ORDER BY symbol ASC`
  );
  return rows.map((r) => String(r.symbol).toUpperCase());
}

export async function getSymbolId(symbol) {
  const sym = symbol.trim().toUpperCase();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id FROM stock_symbols WHERE symbol = ?`,
    [sym]
  );
  if (rows.length) return rows[0].id;
  throw new Error(`Symbol not in stock_symbols: ${sym}`);
}

export async function getLatestBarDate(symbolId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT MAX(date) AS latest_date FROM daily_stock_data WHERE symbol_id = ?`,
    [symbolId]
  );
  const d = rows[0]?.latest_date;
  return d ? toDateString(d) : null;
}

export async function storeStockBars(symbolId, bars) {
  if (!bars.length) return 0;

  const pool = getPool();
  const batch = bars.map((b) => [
    symbolId,
    b.date,
    b.open,
    b.high,
    b.low,
    b.close,
    b.volume,
  ]);

  await pool.query(
    `
    INSERT INTO daily_stock_data (symbol_id, date, open, high, low, close, volume)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      open = VALUES(open),
      high = VALUES(high),
      low = VALUES(low),
      close = VALUES(close),
      volume = VALUES(volume)
    `,
    [batch]
  );

  return bars.length;
}

export async function cleanupOldBars() {
  const years = Math.max(1, Math.min(50, Math.floor(HISTORY_YEARS)));
  const pool = getPool();
  const [result] = await pool.query(
    `DELETE FROM daily_stock_data WHERE date < DATE_SUB(CURDATE(), INTERVAL ${years} YEAR)`
  );
  return result.affectedRows ?? 0;
}

export function mapFmpRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => normalizeBar(row))
    .filter((b) => b.date && Number.isFinite(b.close));
}

export async function fetchFmpEod(symbol, from, to) {
  const url =
    `${FMP_BASE}/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}` +
    `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
    `&apikey=${encodeURIComponent(fmpKey())}`;

  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`FMP EOD ${symbol} (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  return mapFmpRows(data);
}

/** Fetch FMP EOD for a date range and upsert into daily_stock_data. */
export async function saveEodForSymbol(symbol, from, to) {
  const bars = await fetchFmpEod(symbol, from, to);
  if (!bars.length) {
    return { symbol, status: "empty", count: 0 };
  }

  const symbolId = await getSymbolId(symbol);
  const n = await storeStockBars(symbolId, bars);
  return {
    symbol,
    status: "ok",
    count: n,
    from: bars[0].date,
    to: bars[bars.length - 1].date,
  };
}

function parseSymbolTokens(raw) {
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** --symbol AAPL or --symbol AAPL,TSLA or --symbol AAPL, TSLA, BTCUSD */
export function parseSymbolArgs(argv) {
  const args = argv.slice(2);
  const symbols = [];
  let limit = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--symbol") {
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        symbols.push(...parseSymbolTokens(args[i]));
        i++;
      }
      i--;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = Number(args[++i]);
    }
  }
  return { symbols: [...new Set(symbols)], limit };
}

export async function resolveSymbolList(argv) {
  const { symbols: cliSymbols, limit } = parseSymbolArgs(argv);
  let symbols = cliSymbols.length ? cliSymbols : await listSymbols();
  if (!symbols.length) {
    throw new Error("No active symbols in stock_symbols.");
  }
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    symbols = symbols.slice(0, limit);
  }
  return symbols;
}
