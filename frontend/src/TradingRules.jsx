export default function TradingRules() {
  return (
    <div className="rules-page">
      <h1 className="rules-title">Entry &amp; exit rules</h1>
      <p className="rules-intro">
        Chart signals use your MA settings and entry-confirm mode. The nightly
        scanner uses one close above fast (single confirm) with optimized periods
        per symbol.
      </p>

      <section className="rules-section">
        <h2>Entry (long)</h2>
        <p>All of the following must be true on the entry bar&apos;s daily close:</p>
        <ul>
          <li>Not already in a trade</li>
          <li>Close is above the <strong>slow</strong> moving average</li>
          <li>Close is above the <strong>fast</strong> moving average</li>
          <li>
            <strong>Fast MA is above slow MA</strong> (uptrend alignment)
          </li>
          <li>
            <strong>Entry confirm</strong> (sidebar): either one close above fast,
            or <strong>two consecutive</strong> closes above fast (a dip back
            under fast resets the count)
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Exit</h2>
        <p>While in a trade, on the daily close:</p>
        <ul>
          <li>
            <strong>Exit</strong> when close falls <strong>below the fast</strong>{" "}
            moving average
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Re-entry after an exit</h2>
        <p>
          After an exit, the system requires a <strong>recovery</strong> before
          the next entry:
        </p>
        <ul>
          <li>
            Price must close <strong>above the fast MA</strong> once (resets the
            recovery requirement; applies in both entry-confirm modes)
          </li>
          <li>Until then, new entries are blocked even if other entry conditions match</li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Open positions</h2>
        <p>
          If still in a trade at the end of the loaded history, it is shown as{" "}
          <strong>open</strong> in the trades table with no exit date until a
          future bar triggers an exit.
        </p>
      </section>

      <section className="rules-section rules-section-muted">
        <h2>Optimization</h2>
        <p>
          For each symbol, fast/slow periods can be chosen from the optimizer panel
          (top pairs by minimum of 3-year and 1-year return). The nightly scanner
          stores the best pair per symbol in the database.
        </p>
      </section>
    </div>
  );
}
