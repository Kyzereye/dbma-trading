export default function TradingRules() {
  return (
    <div className="rules-page">
      <h1 className="rules-title">Open &amp; close rules</h1>
      <p className="rules-intro">
        These rules are for <strong>swing trading on daily bars</strong>: each open
        and close is evaluated at the <strong>end-of-day close</strong>, not on
        intraday ticks. Orders are assumed to fill at the <strong>next trading
        day&apos;s open</strong> after the signal bar. Holds are meant to last
        multiple days or longer, not minutes or hours.
      </p>
      <p className="rules-intro">
        Signals are <strong>price vs moving average</strong> — where the daily
        close sits relative to the fast and slow MAs — not a fast/slow MA line
        crossover. Chart signals use the periods and open-confirm mode you set in
        the Chart sidebar. The nightly scan uses one close above fast (single
        confirm) with per-symbol MA periods from optimization — see below.
      </p>

      <section className="rules-section">
        <h2>Open</h2>
        <p>All of the following must be true on the daily close of the open bar:</p>
        <ul>
          <li>Not already in a position</li>
          <li>Close is above the <strong>slow</strong> and <strong>fast</strong> moving average</li>
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

      <p className="rules-intro">
        After a close, a new open only happens when all open rules above are met
        again on a later bar.
      </p>

      <section className="rules-section">
        <h2>Still-open positions</h2>
        <p>
          If still in a position at the end of the loaded history, it is shown as
          still open in the trades table with no close date until a future bar
          triggers a close.
        </p>
      </section>

      <section className="rules-section rules-section-muted">
        <h2>Moving average optimization</h2>
        <p>
          The nightly <strong>Signals</strong> scan and <strong>Daily log</strong>{" "}
          use <strong>SMA</strong> periods chosen per symbol from a grid search on
          trailing ~3 years of history. Each month, the pair is re-tested on data
          available through the prior month (no lookahead) and used for the next
          month. Backtest stats and signals use that walk-forward process.
        </p>
        <p>
          The displayed <strong>opt fast/slow</strong> is the current pair from the
          latest trailing optimization. On the <strong>Chart</strong> tab, leave MA
          inputs blank to use the optimized pair or enter your own periods to override (EMA or SMA from the sidebar).
        </p>
      </section>
    </div>
  );
}
