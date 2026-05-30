import { useCallback, useEffect, useId, useRef, useState } from "react";

const DEBOUNCE_MS = 150;

export default function SymbolAutocomplete({
  value,
  onChange,
  onPick,
  disabled = false,
  placeholder = "AAPL",
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const fetchSuggestions = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      const res = await fetch(`/api/symbols?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      setSuggestions(body.symbols ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, open, fetchSuggestions]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(sym) {
    onChange(sym);
    setOpen(false);
    setHighlight(-1);
    onPick?.(sym);
  }

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open || !suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  return (
    <div className="symbol-ac" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className="symbol-ac-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Stock symbol"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && suggestions.length > 0}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) ? (
        <ul id={listId} className="symbol-ac-list" role="listbox">
          {loading && !suggestions.length ? (
            <li className="symbol-ac-item symbol-ac-muted">Loading…</li>
          ) : null}
          {suggestions.map((sym, i) => (
            <li
              key={sym}
              role="option"
              aria-selected={i === highlight}
              className={
                i === highlight
                  ? "symbol-ac-item symbol-ac-item-active"
                  : "symbol-ac-item"
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(sym)}
              onMouseEnter={() => setHighlight(i)}
            >
              {sym}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
