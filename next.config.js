// STUB V2: Content-Security-Policy ships in REPORT-ONLY mode for the MVP.
// Browsers log violations to the console without breaking the site. After
// live smoke testing on the deployed Amplify URL confirms no legitimate
// resource is blocked, cut over by:
//   1. Renaming the response header from 'Content-Security-Policy-Report-Only'
//      to 'Content-Security-Policy' below.
//   2. Replacing 'unsafe-inline' on script-src and style-src with nonce-based
//      directives — generate per-request nonces in middleware, propagate via
//      header + app/layout, and apply nonces to <Script> / inline <style>.
// Both 'unsafe-inline' tokens in the MVP CSP are intentional: script-src
// 'unsafe-inline' covers Next.js hydration scripts, and style-src
// 'unsafe-inline' covers styled-jsx and inline component styles.

const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Forward server-side env vars to the SSR runtime.
  // Amplify injects env vars at build time only; Next.js inlines these
  // into the server bundle so they're available at request time.
  env: {
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
