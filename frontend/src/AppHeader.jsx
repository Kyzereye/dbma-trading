export default function AppHeader({
  page,
  onGoChart,
  onGoRules,
  onGoDaily,
}) {
  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={onGoChart}>
        JJK Trading Labs
      </button>
      <nav className="app-header-nav" aria-label="Site">
        {page !== "chart" ? (
          <button type="button" className="app-header-link" onClick={onGoChart}>
            Back to chart
          </button>
        ) : null}
        {page !== "rules" ? (
          <button type="button" className="app-header-link" onClick={onGoRules}>
            Open &amp; close rules
          </button>
        ) : null}
        {page !== "daily" ? (
          <button type="button" className="app-header-link" onClick={onGoDaily}>
            Daily opens &amp; closes
          </button>
        ) : null}
      </nav>
    </header>
  );
}
