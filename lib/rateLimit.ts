/**
 * In-memory token bucket rate limiter for Themis Lex API routes.
 * One responsibility: decide whether the current request is allowed for a given key.
 */

// STUB V2: Production swap point.
// The in-memory `buckets` map below is correct for local dev and a single
// long-lived process, but on AWS Amplify each Lambda cold start gets a
// fresh map and warm Lambdas don't share state across instances. That
// means abusers can rotate which instance they hit and effectively bypass
// the limit at scale.
//
// Before relying on this in production at any meaningful traffic, replace
// `buckets` with a shared backend. Two recommended paths:
//   1. @upstash/ratelimit + Upstash Redis — sliding-window or token-bucket
//      algorithms ship in the box, edge-friendly, low-latency. Verify the
//      package is still actively maintained before installing.
//   2. DynamoDB conditional writes — stay fully inside AWS, no extra vendor.
//      Use atomic UpdateItem with a TTL attribute for auto-cleanup.
//
// The exported `checkRateLimit` signature stays the same; only the storage
// layer swaps. Keep the LIMITS config and getClientIp helper as-is.

import type { NextApiRequest } from 'next';

type LimitKey = 'assess' | 'pdf';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface LimitConfig {
  maxTokens: number;
  refillIntervalMs: number;
}

const LIMITS: Record<LimitKey, LimitConfig> = {
  assess: { maxTokens: 5, refillIntervalMs: 60_000 },
  pdf: { maxTokens: 10, refillIntervalMs: 60_000 },
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const remote = req.socket.remoteAddress;
  if (remote && remote.length > 0) return remote.trim();
  return 'unknown';
}

export function checkRateLimit(
  req: NextApiRequest,
  key: LimitKey
): { allowed: boolean; retryAfterSeconds?: number } {
  const config = LIMITS[key];
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const refillRatePerMs = config.maxTokens / config.refillIntervalMs;

  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(bucketKey, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(
    config.maxTokens,
    bucket.tokens + elapsed * refillRatePerMs
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  const tokensShort = 1 - bucket.tokens;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(tokensShort / refillRatePerMs / 1000)
  );
  return { allowed: false, retryAfterSeconds };
}
