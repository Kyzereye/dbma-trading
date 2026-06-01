export default function AppHeader({ page, onGoHome, onGoRules }) {
  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={onGoHome}>
        JJK Trading Labs
      </button>
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
