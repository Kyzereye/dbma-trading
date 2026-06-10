import { useEffect, useRef } from "react";
import { LineSeries, createChart } from "lightweight-charts";

const CHART_HEIGHT = 220;

/** Compounded running P/L % after each closed trade (point at exit date). */
export function runningPnlPctPoints(trades) {
  const chronological = [...trades].sort((a, b) =>
    a.entryDate.localeCompare(b.entryDate)
  );
  let factor = 1;
  const points = [];
  for (const t of chronological) {
    if (!t.open) {
      factor *= t.exitPrice / t.entryPrice;
      points.push({
        time: t.exitDate,
        value: (factor - 1) * 100,
      });
    }
  }
  return points;
}

export default function RunningPnlChart({ points }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: CHART_HEIGHT,
      layout: {
        background: { color: "transparent" },
        textColor: "#8b9bab",
      },
      grid: {
        vertLines: { color: "#2d3a4a" },
        horzLines: { color: "#2d3a4a" },
      },
      rightPriceScale: { borderColor: "#2d3a4a" },
      timeScale: { borderColor: "#2d3a4a" },
    });

    const line = chart.addSeries(LineSeries, {
      color: "#6abf69",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    lineRef.current = line;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const line = lineRef.current;
    const chart = chartRef.current;
    if (!line || !chart || !points?.length) return;

    const last = points[points.length - 1].value;
    line.applyOptions({
      color: last >= 0 ? "#6abf69" : "#ef5350",
    });
    line.setData(points);
    chart.timeScale().fitContent();
  }, [points]);

  if (!points?.length) {
    return <p className="running-pnl-empty">No closed trades yet.</p>;
  }

  return <div ref={containerRef} className="chart-wrap running-pnl-chart" />;
}
