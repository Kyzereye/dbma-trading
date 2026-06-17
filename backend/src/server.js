import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getPool } from "./db.js";
import {
  listScanDates,
  loadScanForDate,
  loadScanForLatestDate,
  loadOptimizedMaForSymbol,
  loadTopPerformers,
  parseTopPerformerQuery,
  searchSymbols,
} from "./scanData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const HISTORY_YEARS = Number(process.env.HISTORY_YEARS) || 3;

function historyStartDate(years) {
  const y = Math.max(1, Math.min(50, Math.floor(years)));
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
}

function normalizeSymbol(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  if (!/^[A-Z0-9.\-^]{1,32}$/.test(s)) return null;
  return s;
}

function normalizeDate(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

const app = express();
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "dbma-trading-backend" });
});

app.get("/api/symbols", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20)
  );

  try {
    const symbols = await searchSymbols(q, limit);
    res.json({ symbols });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Symbol search failed",
    });
  }
});

app.get("/api/dashboard/top-performers", async (req, res) => {
  try {
    const filters = parseTopPerformerQuery(req.query);
    const result = await loadTopPerformers(filters);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Top performers query failed",
    });
  }
});

app.get("/api/scanner", async (req, res) => {
  const topN = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.top ?? "25"), 10) || 25)
  );

  try {
    const { meta, rows } = await loadScanForLatestDate();
    if (!meta) {
      res.json({
        asOfDate: null,
        computedAt: null,
        total: 0,
        entries: [],
        exits: [],
        top: [],
      });
      return;
    }

    const entries = rows.filter((r) => r.lastSignal === "entry");
    const exits = rows.filter((r) => r.lastSignal === "exit");
    const byPnl = [...rows].sort((a, b) => {
      const av = a.runningTotalPct;
      const bv = b.runningTotalPct;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });

    res.json({
      asOfDate: meta.asOfDate,
      computedAt: meta.computedAt,
      total: rows.length,
      entries,
      exits,
      top: byPnl.slice(0, topN),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Scanner query failed",
    });
  }
});

app.get("/api/scanner/day", async (req, res) => {
  const topN = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.top ?? "25"), 10) || 25)
  );

  try {
    const availableDates = await listScanDates();
    if (!availableDates.length) {
      res.json({
        date: null,
        availableDates: [],
        computedAt: null,
        total: 0,
        entries: [],
        exits: [],
        inPosition: [],
        top: [],
      });
      return;
    }

    const requested = normalizeDate(
      typeof req.query.date === "string" ? req.query.date : ""
    );
    const date = requested ?? availableDates[0];

    if (requested && !availableDates.includes(requested)) {
      res.json({
        date: requested,
        hasScan: false,
        availableDates,
        computedAt: null,
        total: 0,
        entries: [],
        exits: [],
        inPosition: [],
        top: [],
      });
      return;
    }

    const scan = await loadScanForDate(date, { topN });
    res.json({
      date: scan.asOfDate,
      hasScan: true,
      availableDates,
      computedAt: scan.computedAt,
      total: scan.total,
      entries: scan.entries,
      exits: scan.exits,
      inPosition: scan.inPosition,
      top: scan.top,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Daily scanner query failed",
    });
  }
});

app.get("/api/daily-stock-data", async (req, res) => {
  const symbol = normalizeSymbol(req.query.symbol);
  if (!symbol) {
    res.status(400).json({ error: "Invalid or missing symbol" });
    return;
  }

  const startDate = historyStartDate(HISTORY_YEARS);
  const pool = getPool();

  try {
    const [rows] = await pool.execute(
      `
      SELECT d.date, d.open, d.high, d.low, d.close, d.volume, s.company_name
      FROM daily_stock_data d
      INNER JOIN stock_symbols s ON d.symbol_id = s.id
      WHERE s.symbol = ?
        AND d.date >= ?
      ORDER BY d.date ASC
      `,
      [symbol, startDate]
    );

    if (!rows.length) {
      res.status(404).json({ error: `No data for ${symbol}` });
      return;
    }

    const data = rows
      .map((row) => ({
        date:
          row.date instanceof Date
            ? row.date.toISOString().slice(0, 10)
            : String(row.date).slice(0, 10),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }));

    const optimizedMa = await loadOptimizedMaForSymbol(symbol);

    res.json({
      symbol,
      companyName: String(rows[0].company_name ?? "").trim() || null,
      historyYears: HISTORY_YEARS,
      fromDate: data[0].date,
      toDate: data[data.length - 1].date,
      count: data.length,
      data,
      optimizedMa,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Database query failed",
      symbol,
    });
  }
});

app.listen(PORT, () => {
  console.log(`DBMA backend listening on http://localhost:${PORT}`);
});
