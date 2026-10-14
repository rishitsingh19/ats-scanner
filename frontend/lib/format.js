export const TIER_LABEL = {
  required: 'Must-have',
  preferred: 'Nice-to-have',
  implied: 'Mentioned',
};

export const TIER_HINT = {
  required: 'Listed as a requirement in the job post',
  preferred: 'Listed as preferred, a plus, or nice to have',
  implied: 'Mentioned in the role description but not stated as a requirement',
};

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function scoreTone(score) {
  if (score === null || score === undefined) return 'muted';
  if (score >= 80) return 'good';
  if (score >= 65) return 'ok';
  if (score >= 45) return 'warn';
  return 'bad';
}
