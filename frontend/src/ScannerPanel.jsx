import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPct } from "./optimizeMa.js";
import { SortableTh, useScanTableSort } from "./scanTableSort.jsx";

function formatPnl(v) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function formatClose(price) {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toFixed(2)}`;
}

function parsePriceBound(value) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function filterRowsByPrice(rows, priceMin, priceMax) {
  const min = parsePriceBound(priceMin);
  const max = parsePriceBound(priceMax);
  if (min == null && max == null) return rows;
  return rows.filter((row) => {
    const skipPrice =
      row.assetType === "forex" || row.assetType === "crypto";
    if (skipPrice) return true;
    if (min != null && (row.price == null || row.price < min)) return false;
    if (max != null && (row.price == null || row.price > max)) return false;
    return true;
  });
}

function ScanTable({ rows, onSelect, emptyMessage, activeSymbol }) {
  const { sortedRows, sortKey, sortDir, toggleSort } = useScanTableSort(rows);

  if (!rows.length) {
    return <p className="scanner-empty">{emptyMessage}</p>;
  }
  return (
    <div className="scanner-scroll">
      <table className="scanner-table">
        <thead>
          <tr>
            <SortableTh col="symbol" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
              Symbol
            </SortableTh>
            <SortableTh
              col="price"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              className="scanner-col-num"
            >
              Close
            </SortableTh>
            <SortableTh
              col="pnl"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              className="scanner-col-num"
            >
              P/L
            </SortableTh>
            <SortableTh
              col="pnlPct"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              className="scanner-col-num"
            >
              P/L%
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.symbol}
              className={
                row.symbol === activeSymbol ? "scanner-row-active" : ""
              }
              onClick={() => onSelect(row)}
              title="Load chart"
            >
              <td>{row.symbol}</td>
              <td className="scanner-col-num">{formatClose(row.price)}</td>
              <td className="scanner-col-num">{formatPnl(row.runningTotal)}</td>
              <td className="scanner-col-num">{formatPct(row.runningTotalPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScannerPanel({ activeSymbol, onSelectSymbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openPriceMin, setOpenPriceMin] = useState("");
  const [openPriceMax, setOpenPriceMax] = useState("");

  const fetchScanner = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/scanner?top=25");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(body);
    } catch (err) {
      setError(err?.message || String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScanner();
  }, [fetchScanner]);

  const handleSelect = (row) => {
    onSelectSymbol(row.symbol, row.optFast, row.optSlow);
  };

  const filteredOpens = useMemo(
    () =>
      data?.entries
        ? filterRowsByPrice(data.entries, openPriceMin, openPriceMax)
        : [],
    [data?.entries, openPriceMin, openPriceMax]
  );

  const openCountLabel =
    data?.entries && filteredOpens.length !== data.entries.length
      ? `${filteredOpens.length} of ${data.entries.length}`
      : String(filteredOpens.length);

  return (
    <div className="dashboard-tab-page scanner-page">
      <header className="scanner-page-header">
        <div className="scanner-page-header-main">
          <h1 className="dashboard-tab-title">
            Signals
            {data?.asOfDate ? (
              <span className="dashboard-tab-subtitle"> — {data.asOfDate}</span>
            ) : null}
            {loading ? (
              <span className="dashboard-tab-subtitle"> (loading…)</span>
            ) : null}
          </h1>
          {data?.asOfDate ? (
            <p className="scanner-meta">
              {data.total} symbols · as of {data.asOfDate}
              <button
                type="button"
                className="scanner-refresh"
                onClick={fetchScanner}
                disabled={loading}
              >
                Refresh
              </button>
            </p>
          ) : null}
        </div>
        <div className="scanner-open-filters">
          <span className="scanner-open-filters-label">Opens — close price</span>
          <div className="user-dash-price-row">
            <label>
              <span>Min $</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openPriceMin}
                onChange={(e) => setOpenPriceMin(e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              <span>Max $</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openPriceMax}
                onChange={(e) => setOpenPriceMax(e.target.value)}
                placeholder="Any"
              />
            </label>
          </div>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && !data?.asOfDate ? (
        <p className="scanner-empty">No scan data yet.</p>
      ) : null}
      {data?.asOfDate ? (
        <>
          <div className="scanner-grid">
            <section>
              <h3 className="scanner-heading">
                Recent opens ({openCountLabel})
              </h3>
              <ScanTable
                rows={filteredOpens}
                onSelect={handleSelect}
                activeSymbol={activeSymbol}
                emptyMessage={
                  data.entries.length
                    ? "No opens in this price range."
                    : "No opens on the latest bar."
                }
              />
            </section>
            <section>
              <h3 className="scanner-heading">
                Recent closes ({data.exits.length})
              </h3>
              <ScanTable
                rows={data.exits}
                onSelect={handleSelect}
                activeSymbol={activeSymbol}
                emptyMessage="No closes on the latest bar."
              />
            </section>
            <section>
              <h3 className="scanner-heading">Top running P/L</h3>
              <ScanTable
                rows={data.top}
                onSelect={handleSelect}
                activeSymbol={activeSymbol}
                emptyMessage="No ranked symbols."
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
