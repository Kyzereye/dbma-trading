# DBMA-trading

Daily OHLC stock charts with EMA/SMA crossover signals, MA optimization, and a nightly symbol scan.

---

## Prerequisites

- Node.js 20+
- MySQL 8+
- `backend/.env` configured (see [Environment](#environment))

---

## Environment

Copy and edit `backend/.env`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here
MYSQL_DATABASE=dbma-trading

HISTORY_YEARS=3

FMP_API_KEY=your_fmp_api_key_here
```

Optional:

```env
INGEST_DELAY_MS=100
SCAN_DELAY_MS=0
```

Install dependencies:

```bash
cd /path/to/DBMA-trading
npm install
npm install --prefix backend
npm install --prefix frontend
```

---

## 1. Create the database (fresh install)

`sql_queries/sql_queries.sql` **drops and recreates** all application tables. Use only for a clean install.

Create the database if it does not exist:

```bash
mysql -h localhost -u root -p -e "CREATE DATABASE IF NOT EXISTS \`dbma-trading\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Apply the schema:

```bash
mysql -h localhost -u root -p dbma-trading < sql_queries/sql_queries.sql
```

Tables created include: `stock_symbols`, `daily_stock_data`, `symbol_daily_scan`, and others defined in that file.

---

## 2. Fill the database manually

Run these steps from the project root in order.

### Step A — Symbol list

US stocks and ETFs (`npm run get-symbols` loads index constituents and Nasdaq listed symbols into `stock_symbols`):

```bash
npm run get-symbols
```

Optional: seed US stocks from the bundled file:

```bash
mysql -h localhost -u root -p dbma-trading < sql_queries/combined_stocks.sql
```

### Step B — Daily price history (FMP)

First-time bulk load (~`HISTORY_YEARS` from `.env`, default 3 years):

```bash
npm run get-bulk-price-data
```

Test on a few symbols:

```bash
npm run get-bulk-price-data -- --symbol AAPL
npm run get-bulk-price-data -- --limit 10
```

Nightly updates (new bars only):

```bash
npm run get-daily-price-data
```

Skip deleting rows older than `HISTORY_YEARS`:

```bash
npm run get-daily-price-data -- --no-cleanup
```

Reads active symbols from `stock_symbols`; stores OHLC in `daily_stock_data`. Shared logic: `scripts/get-stock-data.mjs`.

### Step C — Nightly symbol scan

Precompute optimized MA, opens/closes, and running P/L per symbol into `symbol_daily_scan`:

```bash
npm run scan:nightly
```

Test:

```bash
npm run scan:nightly -- --symbol AAPL
npm run scan:nightly -- --limit 10
```

Requires `daily_stock_data` for each symbol. Powers the **Signals** and **Daily log** tabs in the dashboard.

### Step D — Run the app

```bash
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` to the backend)
- Backend: http://localhost:3001

---

## 3. Cron jobs

Use full paths to `node`/`npm` if needed (especially with nvm). Logs are examples; change paths as you like.

Edit crontab:

```bash
crontab -e
```

### Nightly pipeline (weekdays after market close)

Ingest new bars, then run the symbol scan:

```cron
0 18 * * 1-5 cd /path/to/DBMA-trading && /usr/bin/npm run pipeline:nightly >> /tmp/dbma-pipeline.log 2>&1
```

`pipeline:nightly` runs: `get-daily-price-data` → `scan:nightly`.

### Separate price update and scan (optional)

```cron
0 17 * * 1-5 cd /path/to/DBMA-trading && /usr/bin/npm run get-daily-price-data >> /tmp/dbma-prices.log 2>&1
30 17 * * 1-5 cd /path/to/DBMA-trading && /usr/bin/npm run scan:nightly >> /tmp/dbma-scan.log 2>&1
```

### Weekly symbol list refresh

```cron
0 12 * * 0 cd /path/to/DBMA-trading && /usr/bin/npm run get-symbols >> /tmp/dbma-symbols.log 2>&1
```

Optional — symbol renames and delistings (FMP):

```cron
0 13 * * 0 cd /path/to/DBMA-trading && /usr/bin/npm run sync-symbol-changes >> /tmp/dbma-symbol-changes.log 2>&1
```

Verify:

```bash
crontab -l
tail -f /tmp/dbma-pipeline.log
```

---

## Application API (this project)

Base URL in development: `http://localhost:3001`  
(Vite dev server proxies `/api` from port 5173.)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/symbols?q=AAP&limit=20` | Symbol autocomplete search |
| GET | `/api/daily-stock-data?symbol=AAPL` | OHLC bars for one symbol |
| GET | `/api/scanner?top=25` | Latest symbol scan (opens, closes, top P/L) |
| GET | `/api/scanner/day?date=YYYY-MM-DD` | Symbol scan for one date (opens, closes, in position, top P/L) |

### Examples

```bash
curl "http://localhost:3001/api/health"
curl "http://localhost:3001/api/symbols?q=AA&limit=10"
curl "http://localhost:3001/api/daily-stock-data?symbol=AAPL"
curl "http://localhost:3001/api/scanner?top=25"
curl "http://localhost:3001/api/scanner/day?date=2026-05-18"
```

---

## Financial Modeling Prep API (external)

Store your key in `backend/.env` as `FMP_API_KEY` only. Do not commit it.

Base URL: `https://financialmodelingprep.com/stable`

Symbol list endpoints (append `?apikey=YOUR_KEY`):

| # | Purpose | Endpoint | Full URL |
|---|---------|----------|----------|
| 1 | Actively trading | `/actively-trading-list` | `https://financialmodelingprep.com/stable/actively-trading-list?apikey=YOUR_KEY` |
| 2 | ETFs | `/etf-list` | `https://financialmodelingprep.com/stable/etf-list?apikey=YOUR_KEY` |
| 3 | Crypto | `/cryptocurrency-list` | `https://financialmodelingprep.com/stable/cryptocurrency-list?apikey=YOUR_KEY` |
| 4 | Forex | `/forex-list` | `https://financialmodelingprep.com/stable/forex-list?apikey=YOUR_KEY` |

**US stocks only:** `/actively-trading-list` is global (ADRs, foreign tickers). For a US equity list, use `/stock-list` and filter by exchange (NYSE, NASDAQ, AMEX, etc.) in code, or filter `/etf-list` the same way for US ETFs.

---

## npm scripts reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Backend + frontend dev servers |
| `npm run get-bulk-price-data` | FMP bulk EOD (~3 years) |
| `npm run get-daily-price-data` | FMP nightly EOD update |
| `npm run scan:nightly` | Nightly symbol scan → `symbol_daily_scan` |
| `npm run pipeline:nightly` | `get-daily-price-data` then `scan:nightly` |
| `npm run get-symbols` | Refresh symbol list → `stock_symbols` |
| `npm run sync-symbol-changes` | FMP renames/delistings → `stock_symbols` + `data/symbol-changes.log` |
| `npm run optimize:ma -- AAPL` | CLI MA optimization for one symbol |

---

## SQL files

| File | Use |
|------|-----|
| `sql_queries/sql_queries.sql` | Full schema (fresh install) |
| `sql_queries/combined_stocks.sql` | Seed `stock_symbols` |
