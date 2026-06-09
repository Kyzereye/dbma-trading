import { useCallback, useEffect, useState } from "react";
import { formatPct } from "./optimizeMa.js";
import { SortableTh, useScanTableSort } from "./scanTableSort.jsx";

function formatPnl(v) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
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

  return (
    <div className="dashboard-tab-page scanner-page">
      <h1 className="dashboard-tab-title">
        Signals
        {data?.asOfDate ? (
          <span className="dashboard-tab-subtitle"> — {data.asOfDate}</span>
        ) : null}
        {loading ? (
          <span className="dashboard-tab-subtitle"> (loading…)</span>
        ) : null}
      </h1>
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && !data?.asOfDate ? (
        <p className="scanner-empty">No scan data yet.</p>
      ) : null}
      {data?.asOfDate ? (
        <>
          <p className="scanner-meta">
            {data.total} symbols · as of{" "}
            {data.asOfDate}
            <button
              type="button"
              className="scanner-refresh"
              onClick={fetchScanner}
              disabled={loading}
            >
              Refresh
            </button>
          </p>
          <div className="scanner-grid">
            <section>
              <h3 className="scanner-heading">
                Recent opens ({data.entries.length})
              </h3>
              <ScanTable
                rows={data.entries}
                onSelect={handleSelect}
                activeSymbol={activeSymbol}
                emptyMessage="No opens on the latest bar."
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
