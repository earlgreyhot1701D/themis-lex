/**
 * POST /api/analytics — Lightweight event tracking for Themis Lex.
 * Logs assessment completions and PDF downloads to CloudWatch via console.log.
 * Amplify SSR automatically sends console output to CloudWatch Logs.
 *
 * No user data stored. No PII logged. Events are counts only.
 * No third-party analytics service. No cookies. No tracking pixels.
 *
 * Every field is validated against a whitelist (event, role, sensitivity) or
 * a numeric range (duration_ms) before it is logged. This prevents log
 * forging — a caller cannot inject arbitrary strings (or newlines) into the
 * CloudWatch stream through the free-form metadata fields.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { checkRateLimit } from '@/lib/rateLimit';

const VALID_EVENTS = [
  'assessment_completed',
  'assessment_error',
  'pdf_downloaded',
  'pdf_error',
  'start_over',
] as const;

// Mirror the whitelists enforced by the assessment pipeline (lib/validate.ts).
// Analytics must never log a role or sensitivity the rest of the app rejects.
const VALID_ROLES = ['ja1_2', 'ja3_courtroom', 'jss'] as const;
const VALID_SENSITIVITY = ['low', 'medium', 'high'] as const;

// Upper bound on reported client-side duration. Anything beyond this is
// implausible for a single assessment and is dropped rather than logged.
const MAX_DURATION_MS = 600_000; // 10 minutes

type AnalyticsEvent = (typeof VALID_EVENTS)[number];
type AnalyticsRole = (typeof VALID_ROLES)[number];
type AnalyticsSensitivity = (typeof VALID_SENSITIVITY)[number];

interface AnalyticsPayload {
  event: AnalyticsEvent;
  role?: string;
  sensitivity?: string;
  duration_ms?: number;
}

/**
 * Returns the value only if it is one of the allowed literals, else null.
 * Guarantees nothing unvalidated reaches the log line.
 */
function pickFromWhitelist<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Returns a finite, non-negative, in-range integer or null. Rejects NaN,
 * Infinity, negatives, non-numbers, and absurd values.
 */
function sanitizeDuration(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_DURATION_MS) return null;
  return Math.round(value);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'POST only.' });
  }

  // Rate limit gate — reuse the 'assess' bucket so a burst of analytics
  // beacons can't be used to hammer the endpoint unthrottled.
  const rateLimit = checkRateLimit(req, 'assess');
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    // Analytics is fire-and-forget; a throttled beacon is a no-op for the
    // client, so return the same 204 contract rather than an error.
    return res.status(204).end();
  }

  const body = (req.body ?? {}) as Partial<AnalyticsPayload>;

  // Validate event name — the one required field.
  if (!body.event || !VALID_EVENTS.includes(body.event as AnalyticsEvent)) {
    return res.status(400).json({ error: true, message: 'Invalid event.' });
  }

  // Every metadata field is whitelisted or range-checked before logging.
  const role: AnalyticsRole | null = pickFromWhitelist(body.role, VALID_ROLES);
  const sensitivity: AnalyticsSensitivity | null = pickFromWhitelist(
    body.sensitivity,
    VALID_SENSITIVITY
  );
  const duration_ms = sanitizeDuration(body.duration_ms);

  // Log to CloudWatch — structured JSON for easy querying.
  // No PII, no workflow text, no IP addresses. Just the event type and
  // whitelisted metadata. Unrecognized values are logged as null.
  const logEntry = {
    type: 'analytics',
    event: body.event,
    role,
    sensitivity,
    duration_ms,
    timestamp: new Date().toISOString(),
  };

  console.log('[analytics]', JSON.stringify(logEntry));

  return res.status(204).end();
}
