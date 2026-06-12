import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPct } from "./optimizeMa.js";

function formatPnl(v) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${Number(v).toFixed(2)}`;
}

/** Placeholder favorites until user accounts + API exist. */
const MOCK_FAVORITES = [
  {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    assetType: "stock",
    price: 198.42,
    inTrade: true,
    lastSignal: "open",
  },
  {
    symbol: "MSFT",
    companyName: "Microsoft Corporation",
    assetType: "stock",
    price: 415.2,
    inTrade: false,
    lastSignal: "exit",
  },
  {
    symbol: "BTCUSD",
    companyName: "Bitcoin / US Dollar",
    assetType: "crypto",
    price: null,
    inTrade: true,
    lastSignal: "open",
  },
  {
    symbol: "EURUSD",
    companyName: "Euro / US Dollar",
    assetType: "forex",
    price: null,
    inTrade: false,
    lastSignal: "none",
  },
  {
    symbol: "NVDA",
    companyName: "NVIDIA Corporation",
    assetType: "stock",
    price: 132.15,
    inTrade: false,
    lastSignal: "entry",
  },
];

const ASSET_OPTIONS = [
  { id: "stock", label: "Stocks" },
  { id: "etf", label: "ETFs" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
];

function signalLabel(lastSignal) {
  switch (lastSignal) {
    case "entry":
      return "Open";
    case "exit":
      return "Close";
    case "open":
      return "In position";
    default:
      return "—";
  }
}

function PositionBadge({ inTrade }) {
  return (
    <span className={`user-dash-badge ${inTrade ? "user-dash-badge-in" : "user-dash-badge-out"}`}>
      {inTrade ? "In" : "Out"}
    </span>
  );
}

function SignalBadge({ lastSignal }) {
  const open = lastSignal === "entry" || lastSignal === "open";
  const close = lastSignal === "exit";
  const cls = open
    ? "user-dash-badge-open"
    : close
      ? "user-dash-badge-close"
      : "user-dash-badge-muted";
  return (
    <span className={`user-dash-badge ${cls}`}>{signalLabel(lastSignal)}</span>
  );
}

function parsePriceBound(value) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function filterTopRows(rows, priceMin, priceMax, assetTypes) {
  const min = parsePriceBound(priceMin);
  const max = parsePriceBound(priceMax);
  const enabledAssets = Object.entries(assetTypes)
    .filter(([, on]) => on)
    .map(([id]) => id);

  return rows.filter((row) => {
    if (!enabledAssets.includes(row.assetType)) return false;
    const priceFilter =
      row.assetType !== "forex" && row.assetType !== "crypto";
    if (priceFilter && min != null && (row.price == null || row.price < min)) {
      return false;
    }
    if (priceFilter && max != null && (row.price == null || row.price > max)) {
      return false;
    }
    return true;
  });
}

function formatClose(price) {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toFixed(2)}`;
}

export default function UserDashboardTab({ onSelectSymbol, onGoRules }) {
  const [priceMin, setPriceMin] = useState("10");
  const [priceMax, setPriceMax] = useState("20");
  const [assetTypes, setAssetTypes] = useState({
    stock: true,
    etf: true,
    crypto: false,
    forex: false,
  });
  const [topRows, setTopRows] = useState([]);
  const [scanMeta, setScanMeta] = useState(null);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState("");

  const fetchTop = useCallback(async () => {
    setTopLoading(true);
    setTopError("");
    try {
      const params = new URLSearchParams({ top: "25" });
      if (priceMin !== "") params.set("priceMin", priceMin);
      if (priceMax !== "") params.set("priceMax", priceMax);
      const enabledAssets = Object.entries(assetTypes)
        .filter(([, on]) => on)
        .map(([id]) => id);
      params.set("assetTypes", enabledAssets.join(","));

      const res = await fetch(`/api/dashboard/top-performers?${params}`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTopRows([]);
        setScanMeta(null);
        setTopError(body.error || `Top performers failed (${res.status})`);
        return;
      }
      setTopRows(body.top ?? []);
      setScanMeta({ asOfDate: body.asOfDate ?? null });
    } catch (err) {
      setTopRows([]);
      setScanMeta(null);
      setTopError(err?.message || "Top performers request failed");
    } finally {
      setTopLoading(false);
    }
  }, [priceMin, priceMax, assetTypes]);

  const topDisplayRows = useMemo(
    () =>
      filterTopRows(topRows, priceMin, priceMax, assetTypes)
        .sort((a, b) => {
          const av = a.runningTotalPct;
          const bv = b.runningTotalPct;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return bv - av;
        })
        .slice(0, 25),
    [topRows, priceMin, priceMax, assetTypes]
  );

  useEffect(() => {
    fetchTop();
  }, [fetchTop]);

  const favoritesFiltered = useMemo(
    () => filterTopRows(MOCK_FAVORITES, priceMin, priceMax, assetTypes),
    [assetTypes, priceMin, priceMax]
  );

  function toggleAsset(id) {
    setAssetTypes((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="dashboard-tab-page user-dashboard">
      <header className="user-dash-header">
        <div>
          <h1 className="dashboard-tab-title">Dashboard</h1>
          <p className="user-dash-lead">
            Your favorites, scan highlights, and filters.
          </p>
        </div>
        {scanMeta?.asOfDate ? (
          <p className="scanner-meta user-dash-scan-meta">
            Scan {scanMeta.asOfDate}
          </p>
        ) : null}
      </header>

      <div className="user-dash-layout">
        <aside className="user-dash-settings" aria-label="Dashboard settings">
          <h2 className="user-dash-section-title">Settings</h2>

          <fieldset className="user-dash-fieldset">
            <legend>Top 25 price range</legend>
            <p className="user-dash-hint">
              Share price (last close), not P/L.
            </p>
            <div className="user-dash-price-row">
              <label>
                <span>Min $</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Any"
                />
              </label>
              <label>
                <span>Max $</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Any"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="user-dash-fieldset">
            <legend>Asset types</legend>
            <ul className="user-dash-checklist">
              {ASSET_OPTIONS.map(({ id, label }) => (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(assetTypes[id])}
                      onChange={() => toggleAsset(id)}
                    />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </aside>

        <div className="user-dash-main">
          <section className="user-dash-panel">
            <h2 className="user-dash-section-title">Favorites</h2>
            <p className="user-dash-hint user-dash-coming-soon">
              Sample — coming soon
            </p>
            {favoritesFiltered.length ? (
              <div className="scanner-scroll">
                <table className="scanner-table user-dash-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Company</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th className="scanner-col-num">P/L</th>
                      <th className="scanner-col-num">P/L%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {favoritesFiltered.map((row) => (
                      <tr
                        key={row.symbol}
                        onClick={() =>
                          onSelectSymbol?.(row.symbol, 21, 50)
                        }
                        title="Open chart"
                      >
                        <td>{row.symbol}</td>
                        <td className="daily-signals-company">
                          {row.companyName ?? "—"}
                        </td>
                        <td>
                          <PositionBadge inTrade={row.inTrade} />
                        </td>
                        <td>
                          <SignalBadge lastSignal={row.lastSignal} />
                        </td>
                        <td className="scanner-col-num">—</td>
                        <td className="scanner-col-num">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="scanner-empty">No favorites match your filters.</p>
            )}
          </section>

          <section className="user-dash-panel">
            <h2 className="user-dash-section-title">Top performers</h2>
            <p className="user-dash-hint">
              Best running P/L% among symbols in your price range (up to 25).
            </p>
            {topError ? <p className="error">{topError}</p> : null}
            {topLoading ? (
              <p className="daily-signals-status">Loading…</p>
            ) : topDisplayRows.length > 0 ? (
              <table className="scanner-table user-dash-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th className="scanner-col-num">Close</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th className="scanner-col-num">P/L</th>
                    <th className="scanner-col-num">P/L%</th>
                  </tr>
                </thead>
                <tbody>
                  {topDisplayRows.map((row, i) => {
                    const inTrade = row.lastSignal === "open";
                    return (
                      <tr
                        key={row.symbol}
                        onClick={() =>
                          onSelectSymbol?.(row.symbol, row.optFast, row.optSlow)
                        }
                        title="Open chart"
                      >
                        <td>{i + 1}</td>
                        <td>{row.symbol}</td>
                        <td className="daily-signals-company">
                          {row.companyName ?? "—"}
                        </td>
                        <td className="scanner-col-num">{formatClose(row.price)}</td>
                        <td>
                          <PositionBadge inTrade={inTrade} />
                        </td>
                        <td>
                          <SignalBadge lastSignal={row.lastSignal} />
                        </td>
                        <td className="scanner-col-num">
                          {formatPnl(row.runningTotal)}
                        </td>
                        <td className="scanner-col-num">
                          {formatPct(row.runningTotalPct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </section>
        </div>

        <aside className="user-dash-about" aria-label="About this site">
          <h2 className="user-dash-section-title">About JJK Trading Labs</h2>
          <p className="user-dash-about-lead">
            This is a free-to-use daily-bar swing trading research tool. Signals are evaluated
            at the end-of-day close — not on intraday ticks.  It is for information and education purposes only.
          </p>
          <p>
            The site analyzes over 4000 major US stocks, etfs, forex pairs, and crypto symbols each night, evaluating their historical
            performance, and surfaces open and close signals when price crosses
            relative to fast and slow moving averages — not when the two MA lines
            cross each other. Each symbol uses its own optimized fast and slow
            periods.
          </p>
          <p>
            Use the <strong>Signals</strong> tab for a scan of today's symbols, the{" "}
            <strong>Daily log</strong> for history by date, and click any symbol
            to open its chart with trades and running P/L.
          </p>
          <p>
            Entry and exit logic is documented on the rules page.
          </p>
          {onGoRules ? (
            <button
              type="button"
              className="user-dash-about-rules-btn"
              onClick={onGoRules}
            >
              Open &amp; close rules
            </button>
          ) : null}
          <p className="user-dash-about-note">
            No accounts or saved settings — this is an early preview. To share
            feedback, reply on our Reddit post.
          </p>
        </aside>
      </div>
    </div>
  );
}
