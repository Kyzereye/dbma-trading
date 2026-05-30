import { getPool } from "./db.js";

const HISTORY_YEARS = Number(process.env.HISTORY_YEARS) || 3;

function historyStartDate(years) {
  const y = Math.max(1, Math.min(50, Math.floor(years)));
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
}

function mapBarRow(row) {
  return {
    date:
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date).slice(0, 10),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

export async function listSymbols() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT symbol FROM stock_symbols ORDER BY symbol ASC`
  );
  return rows.map((r) => String(r.symbol).toUpperCase());
}

/** Active US equities for MA ingest + nightly scan (excludes crypto/forex). */
export async function listScannableSymbols() {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      `
      SELECT symbol FROM stock_symbols
      WHERE is_active = 1 AND asset_type IN ('stock', 'etf')
      ORDER BY symbol ASC
      `
    );
    return rows.map((r) => String(r.symbol).toUpperCase());
  } catch {
    return listSymbols();
  }
}

export async function searchSymbols(query, limit = 20) {
  const lim = Math.min(50, Math.max(1, Math.floor(limit) || 20));
  const pool = getPool();
  const q = String(query ?? "")
    .trim()
    .toUpperCase();

  if (!q) {
    const [rows] = await pool.execute(
      `SELECT symbol FROM stock_symbols ORDER BY symbol ASC LIMIT ${lim}`
    );
    return rows.map((r) => String(r.symbol).toUpperCase());
  }

  const [rows] = await pool.execute(
    `
    SELECT symbol FROM stock_symbols
    WHERE symbol LIKE ?
    ORDER BY symbol ASC
    LIMIT ${lim}
    `,
    [`${q}%`]
  );
  return rows.map((r) => String(r.symbol).toUpperCase());
}

export async function loadBarsForSymbol(symbol) {
  const startDate = historyStartDate(HISTORY_YEARS);
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT d.date, d.open, d.high, d.low, d.close, d.volume
    FROM daily_stock_data d
    INNER JOIN stock_symbols s ON d.symbol_id = s.id
    WHERE s.symbol = ?
      AND d.date >= ?
    ORDER BY d.date ASC
    `,
    [symbol, startDate]
  );
  return rows.map(mapBarRow);
}

export async function upsertScanRow(symbol, scan) {
  const pool = getPool();
  await pool.execute(
    `
    INSERT INTO symbol_daily_scan (
      symbol, as_of_date, opt_fast, opt_slow, opt_used_default,
      opt_r3y, opt_r1y, opt_min_return, running_total,
      last_signal, signal_date, bar_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      opt_fast = VALUES(opt_fast),
      opt_slow = VALUES(opt_slow),
      opt_used_default = VALUES(opt_used_default),
      opt_r3y = VALUES(opt_r3y),
      opt_r1y = VALUES(opt_r1y),
      opt_min_return = VALUES(opt_min_return),
      running_total = VALUES(running_total),
      last_signal = VALUES(last_signal),
      signal_date = VALUES(signal_date),
      bar_count = VALUES(bar_count),
      computed_at = CURRENT_TIMESTAMP
    `,
    [
      symbol,
      scan.asOfDate,
      scan.optFast,
      scan.optSlow,
      scan.optUsedDefault ? 1 : 0,
      scan.optR3y,
      scan.optR1y,
      scan.optMinReturn,
      scan.runningTotal,
      scan.lastSignal,
      scan.signalDate,
      scan.barCount,
    ]
  );
}

export async function getLatestScanMeta() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT as_of_date AS asOfDate, MAX(computed_at) AS computedAt
    FROM symbol_daily_scan
    GROUP BY as_of_date
    ORDER BY as_of_date DESC
    LIMIT 1
    `
  );
  if (!rows.length) return null;
  return {
    asOfDate:
      rows[0].asOfDate instanceof Date
        ? rows[0].asOfDate.toISOString().slice(0, 10)
        : String(rows[0].asOfDate).slice(0, 10),
    computedAt: rows[0].computedAt,
  };
}

function mapScanRow(row) {
  return {
    symbol: row.symbol,
    asOfDate:
      row.as_of_date instanceof Date
        ? row.as_of_date.toISOString().slice(0, 10)
        : String(row.as_of_date).slice(0, 10),
    optFast: Number(row.opt_fast),
    optSlow: Number(row.opt_slow),
    optUsedDefault: Boolean(row.opt_used_default),
    optR3y: row.opt_r3y != null ? Number(row.opt_r3y) : null,
    optR1y: row.opt_r1y != null ? Number(row.opt_r1y) : null,
    optMinReturn: row.opt_min_return != null ? Number(row.opt_min_return) : null,
    runningTotal: Number(row.running_total),
    lastSignal: row.last_signal,
    signalDate:
      row.signal_date == null
        ? null
        : row.signal_date instanceof Date
          ? row.signal_date.toISOString().slice(0, 10)
          : String(row.signal_date).slice(0, 10),
    barCount: Number(row.bar_count),
  };
}

export async function loadScanForLatestDate() {
  const meta = await getLatestScanMeta();
  if (!meta) return { meta: null, rows: [] };

  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT symbol, as_of_date, opt_fast, opt_slow, opt_used_default,
           opt_r3y, opt_r1y, opt_min_return, running_total,
           last_signal, signal_date, bar_count
    FROM symbol_daily_scan
    WHERE as_of_date = ?
    ORDER BY symbol ASC
    `,
    [meta.asOfDate]
  );

  return { meta, rows: rows.map(mapScanRow) };
}
