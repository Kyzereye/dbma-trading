import { useCallback, useEffect, useState } from "react";
import { formatPct } from "./optimizeMa.js";

function formatPnl(v) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function ScanTable({ rows, onSelect, emptyMessage, activeSymbol }) {
  if (!rows.length) {
    return <p className="scanner-empty">{emptyMessage}</p>;
  }
  return (
    <div className="scanner-scroll">
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>MA</th>
            <th className="scanner-col-num">P/L</th>
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className={
                row.symbol === activeSymbol ? "scanner-row-active" : ""
              }
              onClick={() => onSelect(row)}
              title="Load chart with optimized MA"
            >
              <td>{row.symbol}</td>
              <td>
                {row.optFast}/{row.optSlow}
              </td>
              <td className="scanner-col-num">{formatPnl(row.runningTotal)}</td>
              <td>{formatPct(row.optMinReturn)}</td>
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
    <details className="expand-panel scanner-panel" open>
      <summary>
        Nightly scanner
        {data?.asOfDate ? ` — ${data.asOfDate}` : ""}
        {loading ? " (loading…)" : ""}
      </summary>
      <div className="expand-body">
        {error ? <p className="error">{error}</p> : null}
        {!loading && !error && !data?.asOfDate ? (
          <p className="scanner-empty">
            No scan data yet.
          </p>
        ) : null}
        {data?.asOfDate ? (
          <>
            <p className="scanner-meta">
              {data.total} symbols · optimized EMA per symbol · as of{" "}
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
                  Recent entries ({data.entries.length})
                </h3>
                <ScanTable
                  rows={data.entries}
                  onSelect={handleSelect}
                  activeSymbol={activeSymbol}
                  emptyMessage="No entries on the latest bar."
                />
              </section>
              <section>
                <h3 className="scanner-heading">
                  Recent exits ({data.exits.length})
                </h3>
                <ScanTable
                  rows={data.exits}
                  onSelect={handleSelect}
                  activeSymbol={activeSymbol}
                  emptyMessage="No exits on the latest bar."
                />
              </section>
              <section>
                <h3 className="scanner-heading">
                  In position ({data.inPosition?.length ?? 0})
                </h3>
                <ScanTable
                  rows={data.inPosition ?? []}
                  onSelect={handleSelect}
                  activeSymbol={activeSymbol}
                  emptyMessage="No open positions."
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
              <section>
                <h3 className="scanner-heading">Bottom running P/L</h3>
                <ScanTable
                  rows={data.bottom}
                  onSelect={handleSelect}
                  activeSymbol={activeSymbol}
                  emptyMessage="No ranked symbols."
                />
              </section>
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}
