/**
 * Load US stocks & ETFs into stock_symbols from FMP company-screener.
 *
 *   npm run get-symbols
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, getPool } from "../backend/src/db.js";
import { normalizeCompanyName } from "./normalizeCompanyName.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORED_SYMBOLS_PATH = path.join(__dirname, "..", "data", "stored-symbols.json");
const US_EXCHANGES = ["AMEX", "NASDAQ", "NYSE"];
const VOLUME_MORE_THAN = 250000;
const LIMIT = 10000;

async function main() {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) throw new Error("FMP_API_KEY is missing in backend/.env");

  console.log(`Fetching FMP company-screener (volumeMoreThan=${VOLUME_MORE_THAN})…`);
  const url =
    `https://financialmodelingprep.com/stable/company-screener` +
    `?volumeMoreThan=${VOLUME_MORE_THAN}&isActivelyTrading=true&limit=${LIMIT}` +
    `&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`FMP request failed (${res.status}): ${body.slice(0, 200)}`);

  const companies = JSON.parse(body);
  if (!Array.isArray(companies)) throw new Error("FMP company-screener: expected a JSON array");

  const rows = [];
  for (const entry of companies) {
    if (!US_EXCHANGES.includes(entry.exchangeShortName)) continue;

    const symbol = String(entry.symbol ?? "").trim().toUpperCase();
    if (!symbol) continue;

    rows.push({
      symbol,
      company_name: normalizeCompanyName(entry.companyName ?? entry.name ?? symbol),
      asset_type: entry.isEtf ? "etf" : "stock",
      exchange: entry.exchangeShortName ?? null,
      is_active: entry.isActivelyTrading === false ? 0 : 1,
    });
  }
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));

  console.log(`Loaded ${rows.length} symbols; upserting…`);

  const pool = getPool();
  for (const row of rows) {
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

  await mkdir(path.dirname(STORED_SYMBOLS_PATH), { recursive: true });
  await writeFile(STORED_SYMBOLS_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

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
