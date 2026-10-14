export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Calls the backend at /api on the same domain. On Vercel, /vercel.json routes /api/* to the
 * backend service; when running locally without Vercel, next.config.js forwards it.
 * Every failure becomes an ApiError with a readable message (SRS 5.4 Reliability).
 */
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const opts = { method, credentials: 'include', headers: {}, signal };
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your internet connection and try again.', 'NETWORK', 0);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const fallback =
      res.status === 413
        ? 'This file is too large. The limit is 5 MB.'
        : res.status >= 500
          ? 'The server ran into a problem. Please try again in a moment.'
          : `Request failed (${res.status}).`;
    throw new ApiError(data?.error?.message || fallback, data?.error?.code || 'HTTP_ERROR', res.status);
  }
  return data;
}
