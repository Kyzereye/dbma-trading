export default function AppHeader({ page, onGoHome, onGoRules }) {
  return (
    <header className="app-header">
      <div className="app-header-brand-wrap">
        <button type="button" className="app-header-brand" onClick={onGoHome}>
          JJK Trading Labs
        </button>
      </div>
      <p className="app-header-disclaimer">
        For education and information only — not financial advice.
      </p>
      <nav className="app-header-nav" aria-label="Site">
        {page !== "app" ? (
          <button type="button" className="app-header-link" onClick={onGoHome}>
            Dashboard
          </button>
        ) : null}
        {page !== "rules" ? (
          <button type="button" className="app-header-link" onClick={onGoRules}>
            Open &amp; close rules
          </button>
        ) : null}
      </nav>
    </header>
  );
}
