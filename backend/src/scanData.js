import { getPool } from "./db.js";

const HISTORY_YEARS = Number(process.env.HISTORY_YEARS) || 3;

function historyStartDate(years) {
  const y = Math.max(1, Math.min(50, Math.floor(years)));
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
}

function formatDateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function mapBarRow(row) {
  return {
    date: formatDateOnly(row.date),
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
      WHERE is_active = 1
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
      opt_r3y, opt_r1y, opt_min_return, running_total, running_total_pct,
      last_signal, signal_date, bar_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      opt_fast = VALUES(opt_fast),
      opt_slow = VALUES(opt_slow),
      opt_used_default = VALUES(opt_used_default),
      opt_r3y = VALUES(opt_r3y),
      opt_r1y = VALUES(opt_r1y),
      opt_min_return = VALUES(opt_min_return),
      running_total = VALUES(running_total),
      running_total_pct = VALUES(running_total_pct),
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
      scan.runningTotalPct,
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
    asOfDate: formatDateOnly(rows[0].asOfDate),
    computedAt: rows[0].computedAt,
  };
}

function mapScanRow(row) {
  return {
    symbol: row.symbol,
    companyName: row.company_name
      ? String(row.company_name).trim() || null
      : null,
    assetType: row.asset_type ? String(row.asset_type) : "stock",
    price: row.last_close != null ? Number(row.last_close) : null,
    asOfDate: formatDateOnly(row.as_of_date),
    optFast: Number(row.opt_fast),
    optSlow: Number(row.opt_slow),
    optUsedDefault: Boolean(row.opt_used_default),
    optR3y: row.opt_r3y != null ? Number(row.opt_r3y) : null,
    optR1y: row.opt_r1y != null ? Number(row.opt_r1y) : null,
    optMinReturn: row.opt_min_return != null ? Number(row.opt_min_return) : null,
    runningTotal: Number(row.running_total),
    runningTotalPct:
      row.running_total_pct != null ? Number(row.running_total_pct) : null,
    lastSignal: row.last_signal,
    signalDate: formatDateOnly(row.signal_date),
    barCount: Number(row.bar_count),
  };
}

const SCAN_ROW_SELECT = `
  SELECT scan.symbol, scan.as_of_date, scan.opt_fast, scan.opt_slow,
         scan.opt_used_default, scan.opt_r3y, scan.opt_r1y, scan.opt_min_return,
         scan.running_total, scan.running_total_pct,
         scan.last_signal, scan.signal_date, scan.bar_count,
         ss.company_name, ss.asset_type, d.close AS last_close
  FROM symbol_daily_scan scan
  LEFT JOIN stock_symbols ss ON ss.symbol = scan.symbol
  LEFT JOIN daily_stock_data d ON d.symbol_id = ss.id AND d.date = scan.as_of_date
`;

export function applyScanFilters(
  rows,
  { priceMin = null, priceMax = null, assetTypes = null } = {}
) {
  return rows.filter((row) => {
    if (assetTypes != null && !assetTypes.includes(row.assetType)) {
      return false;
    }
    const priceFilter =
      row.assetType !== "forex" && row.assetType !== "crypto";
    if (priceFilter && priceMin != null) {
      if (row.price == null || row.price < priceMin) return false;
    }
    if (priceFilter && priceMax != null) {
      if (row.price == null || row.price > priceMax) return false;
    }
    return true;
  });
}

export function parseTopPerformerQuery(query) {
  const topN = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.top ?? "10"), 10) || 10)
  );
  const priceMinRaw = query.priceMin;
  const priceMaxRaw = query.priceMax;
  const priceMin =
    priceMinRaw !== undefined && priceMinRaw !== ""
      ? Number(priceMinRaw)
      : null;
  const priceMax =
    priceMaxRaw !== undefined && priceMaxRaw !== ""
      ? Number(priceMaxRaw)
      : null;
  const assetTypes =
    query.assetTypes !== undefined
      ? String(query.assetTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

  return {
    topN,
    priceMin: Number.isFinite(priceMin) ? priceMin : null,
    priceMax: Number.isFinite(priceMax) ? priceMax : null,
    assetTypes,
  };
}

export async function loadTopPerformers(filters) {
  const { meta, rows } = await loadScanForLatestDate();
  if (!meta) {
    return { asOfDate: null, computedAt: null, top: [] };
  }

  const filtered = applyScanFilters(rows, filters);
  const byPnl = [...filtered].sort((a, b) => b.runningTotal - a.runningTotal);

  return {
    asOfDate: meta.asOfDate,
    computedAt: meta.computedAt,
    top: byPnl.slice(0, filters.topN),
  };
}

export async function loadScanForLatestDate() {
  const meta = await getLatestScanMeta();
  if (!meta) return { meta: null, rows: [] };

  const pool = getPool();
  const [rows] = await pool.execute(
    `
    ${SCAN_ROW_SELECT}
    WHERE scan.as_of_date = ?
    ORDER BY scan.symbol ASC
    `,
    [meta.asOfDate]
  );

  return { meta, rows: rows.map(mapScanRow) };
}

export async function listScanDates(limit = 500) {
  const lim = Math.min(2000, Math.max(1, Math.floor(limit) || 500));
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    SELECT DISTINCT as_of_date
    FROM symbol_daily_scan
    ORDER BY as_of_date DESC
    LIMIT ${lim}
    `
  );
  return rows.map((r) => formatDateOnly(r.as_of_date));
}

export async function loadScanForDate(asOfDate, { topN = 25 } = {}) {
  const lim = Math.min(100, Math.max(1, Math.floor(topN) || 25));
  const pool = getPool();
  const [rows] = await pool.execute(
    `
    ${SCAN_ROW_SELECT}
    WHERE scan.as_of_date = ?
    ORDER BY scan.symbol ASC
    `,
    [asOfDate]
  );

  const mapped = rows.map(mapScanRow);
  const entries = mapped.filter((r) => r.lastSignal === "entry");
  const exits = mapped.filter((r) => r.lastSignal === "exit");
  const inPosition = mapped.filter((r) => r.lastSignal === "open");
  const byPnl = [...mapped].sort((a, b) => b.runningTotal - a.runningTotal);

  const [metaRows] = await pool.execute(
    `
    SELECT MAX(computed_at) AS computedAt
    FROM symbol_daily_scan
    WHERE as_of_date = ?
    `,
    [asOfDate]
  );

  return {
    asOfDate,
    computedAt: metaRows[0]?.computedAt ?? null,
    total: mapped.length,
    entries,
    exits,
    inPosition,
    top: byPnl.slice(0, lim),
  };
}
