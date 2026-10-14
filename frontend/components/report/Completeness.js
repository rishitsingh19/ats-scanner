/** REQ-3.3: completeness checklist with tips for anything missing. */
export default function Completeness({ completeness, weakAreas }) {
  const todo = completeness.items.filter((i) => !i.complete);
  const done = completeness.items.filter((i) => i.complete);
  return (
    <section className="sheet stack" aria-labelledby="comp-title">
      <div className="sheet-title">
        <h2 id="comp-title">Resume checklist</h2>
        <p>
          {done.length} of {completeness.items.length} done
        </p>
      </div>
      <ul className="check-list">
        {todo.map((i) => (
          <li key={i.key} className="todo">
            <span className="mark" aria-hidden="true">
              !
            </span>
            <span>
              <strong>{i.label}</strong>
              <span className="sr-only"> (to do)</span>
              <span className="tip">{i.tip}</span>
            </span>
          </li>
        ))}
        {done.map((i) => (
          <li key={i.key} className="done">
            <span className="mark" aria-hidden="true">
              ✓
            </span>
            <span>
              {i.label}
              <span className="sr-only"> (done)</span>
            </span>
          </li>
        ))}
      </ul>

      {weakAreas && weakAreas.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 6 }}>Parts of the job your resume barely covers</h3>
          <p className="subtle" style={{ marginBottom: 8 }}>
            If you have experience with these, describe it in a bullet point.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {weakAreas.map((w) => (
              <li key={w.text} style={{ marginTop: 4 }}>
                {w.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
