/**
 * Load US stocks & ETFs into stock_symbols from index/list sources.
 * Forex/crypto: sql_queries/forex_and_crypto_symbols.sql (run once on install).
 * Snapshot: data/stored-symbols.json (written after each run).
 *
 *   npm run get-symbols
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, getPool } from "../backend/src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STORED_SYMBOLS_PATH = path.join(__dirname, "..", "data", "stored-symbols.json");

const URLS = {
  sp500: "https://yfiua.github.io/index-constituents/constituents-sp500.json",
  dowjones: "https://yfiua.github.io/index-constituents/constituents-dowjones.json",
  nasdaqListed:
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed.csv",
};

function parseCsvRow(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

async function fetchText(url) {
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) ${url}: ${body.slice(0, 200)}`);
  }
  return body;
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function normalizeSymbol(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function assetTypeFromNasdaqSecurityName(securityName) {
  const name = String(securityName ?? "");
  if (/\bETF\b/i.test(name)) return "etf";
  if (/Common Stock/i.test(name)) return "stock";
  return null;
}

function rowFromIndexJson(entry) {
  const symbol = normalizeSymbol(entry.Symbol ?? entry.symbol);
  if (!symbol) return null;

  return {
    symbol,
    company_name: String(entry.Name ?? entry.name ?? symbol).trim(),
    asset_type: "stock",
    exchange: null,
    is_active: 1,
  };
}

function parseNasdaqListedCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [symbolRaw, securityName] = parseCsvRow(lines[i]);
    const symbol = normalizeSymbol(symbolRaw);
    if (!symbol) continue;

    const asset_type = assetTypeFromNasdaqSecurityName(securityName);
    if (!asset_type) continue;

    rows.push({
      symbol,
      company_name: String(securityName ?? symbol).trim(),
      asset_type,
      exchange: "NASDAQ",
      is_active: 1,
    });
  }
  return rows;
}

function mergeSymbol(map, row) {
  const existing = map.get(row.symbol);
  if (!existing) {
    map.set(row.symbol, row);
    return;
  }
  if (!existing.exchange && row.exchange) {
    map.set(row.symbol, { ...existing, exchange: row.exchange });
  }
}

export async function loadSymbolRows() {
  console.log("Fetching S&P 500 constituents…");
  const sp500 = await fetchJson(URLS.sp500);
  if (!Array.isArray(sp500)) {
    throw new Error("S&P 500 JSON: expected an array");
  }

  console.log("Fetching Dow Jones constituents…");
  const dow = await fetchJson(URLS.dowjones);
  if (!Array.isArray(dow)) {
    throw new Error("Dow Jones JSON: expected an array");
  }

  console.log("Fetching Nasdaq listed symbols…");
  const nasdaqCsv = await fetchText(URLS.nasdaqListed);
  const nasdaqRows = parseNasdaqListedCsv(nasdaqCsv);

  const bySymbol = new Map();

  for (const entry of sp500) {
    const row = rowFromIndexJson(entry);
    if (row) mergeSymbol(bySymbol, row);
  }

  for (const entry of dow) {
    const row = rowFromIndexJson(entry);
    if (row) mergeSymbol(bySymbol, row);
  }

  for (const row of nasdaqRows) {
    mergeSymbol(bySymbol, row);
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function writeStoredSymbolsFile(symbols) {
  await mkdir(path.dirname(STORED_SYMBOLS_PATH), { recursive: true });
  await writeFile(STORED_SYMBOLS_PATH, `${JSON.stringify(symbols, null, 2)}\n`, "utf8");
}

async function upsertSymbol(row) {
  const pool = getPool();
  await pool.execute(
    `
    INSERT INTO stock_symbols (symbol, company_name, asset_type, exchange, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      asset_type = VALUES(asset_type),
      exchange = VALUES(exchange),
      is_active = VALUES(is_active)
    `,
    [row.symbol, row.company_name, row.asset_type, row.exchange, row.is_active]
  );
}

async function main() {
  const rows = await loadSymbolRows();
  console.log(`Loaded ${rows.length} unique symbols; upserting…`);

  for (const row of rows) {
    await upsertSymbol(row);
  }

  await writeStoredSymbolsFile(rows);
  console.log(
    `Done. Upserted ${rows.length} symbols into stock_symbols. Wrote ${rows.length} to data/stored-symbols.json.`
  );
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
