import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPct } from "./optimizeMa.js";
import { SortableTh, useScanTableSort } from "./scanTableSort.jsx";

function formatPnl(v) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function SignalTable({ rows, kind, onSelect, emptyMessage }) {
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
            <SortableTh col="company" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
              Company
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
              key={`${kind}-${row.symbol}`}
              onClick={() => onSelect?.(row)}
              title="Load chart with optimized MA"
            >
              <td>{row.symbol}</td>
              <td className="daily-signals-company">
                {row.companyName ?? "—"}
              </td>
              <td className="scanner-col-num">{formatPnl(row.runningTotal)}</td>
              <td className="scanner-col-num">{formatPct(row.runningTotalPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DailySignals({ onSelectSymbol }) {
  const [date, setDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dateRange = useMemo(() => {
    if (!availableDates.length) return { min: "", max: "" };
    return {
      min: availableDates[availableDates.length - 1],
      max: availableDates[0],
    };
  }, [availableDates]);

  const fetchDay = useCallback(async (selectedDate) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ top: "25" });
      if (selectedDate) q.set("date", selectedDate);
      const res = await fetch(`/api/scanner/day?${q}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(body);
      setAvailableDates(body.availableDates ?? []);
      setDate(selectedDate || body.date || "");
    } catch (err) {
      setError(err?.message || String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDay("");
  }, [fetchDay]);

  function onDateChange(e) {
    const next = e.target.value;
    if (!next || next === date) return;
    setDate(next);
    fetchDay(next);
  }

  function handleSelect(row) {
    onSelectSymbol?.(row.symbol, row.optFast, row.optSlow);
  }

  const hasScanDates = availableDates.length > 0;
  const hasScanForDate = data?.hasScan !== false && Boolean(data?.date);
  const noScanForSelectedDate =
    !loading && !error && date && data?.hasScan === false;

  return (
    <div className="dashboard-tab-page">
      <h1 className="dashboard-tab-title">Daily log</h1>

      {hasScanDates ? (
        <label className="daily-signals-date">
          <span>Date</span>
          <input
            type="date"
            value={date}
            min={dateRange.min}
            max={dateRange.max}
            onChange={onDateChange}
          />
          {loading ? <span className="daily-signals-status">Updating…</span> : null}
        </label>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {loading && !data ? (
        <p className="daily-signals-status">Loading…</p>
      ) : null}

      {!loading && !error && !hasScanDates ? (
        <p className="scanner-empty">No scan data yet.</p>
      ) : null}

      {noScanForSelectedDate ? (
        <p className="scanner-empty">No nightly scan for {date}.</p>
      ) : null}

      {hasScanForDate ? (
        <>
          <p className="scanner-meta">
            {data.total} symbols scanned · {data.entries.length} opens ·{" "}
            {data.exits.length} closes · {data.inPosition?.length ?? 0} in
            position
            {data.computedAt ? (
              <>
                {" "}
                · computed{" "}
                {new Date(data.computedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </>
            ) : null}
          </p>
          <div className="scanner-grid daily-log-grid">
            <section>
              <h2 className="scanner-heading">
                Opens ({data.entries.length})
              </h2>
              <SignalTable
                rows={data.entries}
                kind="entry"
                onSelect={handleSelect}
                emptyMessage="No opens on this date."
              />
            </section>
            <section>
              <h2 className="scanner-heading">Closes ({data.exits.length})</h2>
              <SignalTable
                rows={data.exits}
                kind="exit"
                onSelect={handleSelect}
                emptyMessage="No closes on this date."
              />
            </section>
            <section>
              <h2 className="scanner-heading">
                In position ({data.inPosition?.length ?? 0})
              </h2>
              <SignalTable
                rows={data.inPosition ?? []}
                kind="open"
                onSelect={handleSelect}
                emptyMessage="No open positions on this date."
              />
            </section>
            <section>
              <h2 className="scanner-heading">Top running P/L</h2>
              <SignalTable
                rows={data.top ?? []}
                kind="top"
                onSelect={handleSelect}
                emptyMessage="No ranked symbols."
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
