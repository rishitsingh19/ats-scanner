import { formatDate } from '@/lib/format';

/** REQ-6.2: score trend across scans of the same job. Plain SVG, no chart library needed. */
export default function TrendChart({ points }) {
  const W = 640;
  const H = 240;
  const pad = { l: 36, r: 20, t: 20, b: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = points.length;
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - ((v ?? 0) / 100) * ih;
  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const series = [
    { key: 'keyword', label: 'Keyword match', color: '#c9800e' },
    { key: 'semantic', label: 'Relevance match', color: '#2f6fdb' },
    { key: 'completeness', label: 'Completeness', color: '#1d7f55' },
  ];

  const summary = points.map((p, i) => `Scan ${i + 1} on ${formatDate(p.createdAt)}: ${p.composite}`).join('; ');

  return (
    <figure className="trend" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score trend. ${summary}`}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="label" x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.key} className="sub" d={path(s.key)} stroke={s.color} />
        ))}
        <path className="line-main" d={path('composite')} />
        {points.map((p, i) => (
          <g key={p.scanId}>
            <circle className="dot" cx={x(i)} cy={y(p.composite)} r={5} />
            <text className="val" x={x(i)} y={y(p.composite) - 11} textAnchor="middle">
              {p.composite}
            </text>
            {(n <= 8 || i === 0 || i === n - 1) && (
              <text className="label" x={x(i)} y={H - 12} textAnchor="middle">
                {formatDate(p.createdAt).replace(/,? \d{4}$/, '')}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="legend" style={{ marginTop: 8 }}>
        <span>
          <i style={{ background: '#17263a' }} />
          Overall score
        </span>
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
