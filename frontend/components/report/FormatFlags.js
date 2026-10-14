const SEV_LABEL = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };

/** SRS 4.4: ATS formatting risks, each with a plain-language fix. */
export default function FormatFlags({ flags }) {
  return (
    <section className="sheet stack" aria-labelledby="fmt-title">
      <div className="sheet-title">
        <h2 id="fmt-title">Formatting issues</h2>
        <p>{flags.length ? `${flags.length} found` : 'None found'}</p>
      </div>
      {flags.length === 0 ? (
        <div className="notice notice-ok">No tables, columns, text boxes or other layout problems found. ATS tools should read this resume cleanly.</div>
      ) : (
        <ul className="flag-list">
          {flags.map((f) => (
            <li key={f.code}>
              <span className={`sev sev-${f.severity}`}>{SEV_LABEL[f.severity]}</span>
              <div>
                <strong>{f.title}</strong>
                <p className="subtle" style={{ marginTop: 2 }}>
                  {f.detail}
                </p>
              </div>
              <p className="fix">
                <strong>Fix:</strong> {f.fix}
              </p>
              {f.evidence && <p className="evidence">{f.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
