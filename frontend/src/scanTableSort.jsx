import { useMemo, useState } from "react";

function compareScanRows(a, b, key) {
  switch (key) {
    case "symbol":
      return a.symbol.localeCompare(b.symbol);
    case "company":
      return String(a.companyName ?? "").localeCompare(String(b.companyName ?? ""));
    case "ma":
      return a.optFast - b.optFast || a.optSlow - b.optSlow;
    case "pnl":
      return a.runningTotal - b.runningTotal;
    case "pnlPct": {
      const av = a.runningTotalPct;
      const bv = b.runningTotalPct;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv;
    }
    default:
      return 0;
  }
}

function defaultSortDir(key) {
  return key === "pnl" || key === "pnlPct" ? "desc" : "asc";
}

export function useScanTableSort(rows, initialKey = "symbol") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(() => defaultSortDir(initialKey));

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compareScanRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  }

  return { sortedRows, sortKey, sortDir, toggleSort };
}

export function SortableTh({ col, sortKey, sortDir, onSort, children, className }) {
  const active = sortKey === col;
  const classes = [className, "scanner-sortable"].filter(Boolean).join(" ");
  return (
    <th
      className={classes}
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {active ? (sortDir === "asc" ? " ▴" : " ▾") : ""}
    </th>
  );
}
