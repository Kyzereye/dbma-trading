export default function AppHeader({ page, onGoChart, onGoRules }) {
  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={onGoChart}>
        JJK Trading Labs
      </button>
      {page === "chart" ? (
        <button type="button" className="app-header-link" onClick={onGoRules}>
          Entry &amp; exit rules
        </button>
      ) : (
        <button type="button" className="app-header-link" onClick={onGoChart}>
          Back to chart
        </button>
      )}
    </header>
  );
}
