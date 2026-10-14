/** @type {import('next').NextConfig} */

// All browser calls go to /api/... on the frontend's own domain, so the login cookie stays first-party.
//
// On Vercel (and with `vercel dev`), the top-level rewrite in /vercel.json sends /api/* straight to the
// backend service. Those requests never reach Next.js, so no proxy is needed here.
//
// Only when running the two apps separately (`npm run dev` in each folder) does Next.js need to
// forward /api/* itself. Set BACKEND_URL=http://localhost:5000 in frontend/.env.local for that.
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  experimental: {
    proxyTimeout: 60000, // scans and rewrite generation can take a few seconds
  },
};

module.exports = nextConfig;
