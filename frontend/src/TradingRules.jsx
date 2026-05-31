export default function TradingRules() {
  return (
    <div className="rules-page">
      <h1 className="rules-title">Open &amp; close rules</h1>
      <p className="rules-intro">
        Chart signals use your MA settings and open-confirm mode. The nightly
        scanner uses one close above fast (single confirm) with optimized periods
        per symbol.
      </p>

      <section className="rules-section">
        <h2>Open</h2>
        <p>All of the following must be true on the open bar&apos;s daily close:</p>
        <ul>
          <li>Not already in a position</li>
          <li>Close is above the <strong>slow</strong> moving average</li>
          <li>Close is above the <strong>fast</strong> moving average</li>
          <li>
            <strong>Fast MA is above slow MA</strong> (uptrend alignment)
          </li>
          <li>
            <strong>Open confirm</strong> (sidebar): either one close above fast,
            or <strong>two consecutive</strong> closes above fast (a dip back
            under fast resets the count)
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Close</h2>
        <p>While in a position, on the daily close:</p>
        <ul>
          <li>
            <strong>Close</strong> when price falls <strong>below the fast</strong>{" "}
            moving average
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Re-open after a close</h2>
        <p>
          After a close, the system requires a <strong>recovery</strong> before
          the next open:
        </p>
        <ul>
          <li>
            Price must close <strong>above the fast MA</strong> once (resets the
            recovery requirement; applies in both open-confirm modes)
          </li>
          <li>Until then, new opens are blocked even if other open conditions match</li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>Still-open positions</h2>
        <p>
          If still in a position at the end of the loaded history, it is shown as
          still open in the trades table with no close date until a future bar
          triggers a close.
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
