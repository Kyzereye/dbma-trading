export default function DisclaimerDialog({ onAccept }) {
  return (
    <div className="disclaimer-overlay" role="presentation">
      <div
        className="disclaimer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        aria-describedby="disclaimer-body"
      >
        <h1 id="disclaimer-title" className="disclaimer-title">
          Important notice
        </h1>
        <div id="disclaimer-body" className="disclaimer-body">
          <p>
            <strong>JJK Trading Labs</strong> is free to use and is provided for
            general <strong>information and education only</strong>. It is not a
            brokerage, advisory service, or substitute for professional advice.
          </p>
          <ul>
            <li>
              Nothing on this site is investment, financial, tax, or legal advice,
              and no content should be treated as a recommendation to buy, sell,
              or hold any security.
            </li>
            <li>
              Signals, charts, rankings, and performance figures are research
              tools. Do not rely on this site alone when making trading or
              investment decisions.
            </li>
            <li>
              Any decision to buy or sell is <strong>solely yours</strong>. You
              are responsible for your own due diligence and should consult
              qualified professionals as needed.
            </li>
            <li>
              Past or simulated performance does not guarantee future results.
              Market data and signals may be delayed, incomplete, or contain errors.
            </li>
            <li>
              The creator and operator of this site are{" "}
              <strong>not liable</strong> for any losses, damages, or other harm
              arising from your use of the site or reliance on its content.
            </li>
          </ul>
          <p className="disclaimer-accept-note">
            By continuing, you confirm that you have read and understood this
            notice.
          </p>
        </div>
        <button
          type="button"
          className="disclaimer-accept-btn"
          onClick={onAccept}
        >
          I understand and agree
        </button>
      </div>
    </div>
  );
}
