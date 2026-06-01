const TABS = [
  { id: "signals", label: "Signals" },
  { id: "daily", label: "Daily log" },
  { id: "symbolchanges", label: "Symbol Changes" },
  { id: "chart", label: "Chart" },
];

export default function DashboardTabs({ tab, onChange }) {
  return (
    <nav className="app-tabs" aria-label="Dashboard">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={tab === id ? "app-tab app-tab-active" : "app-tab"}
          onClick={() => onChange(id)}
          aria-current={tab === id ? "page" : undefined}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
