/**
 * POST /api/analytics — Lightweight event tracking for Themis Lex.
 * Logs assessment completions and PDF downloads to CloudWatch via console.log.
 * Amplify SSR automatically sends console output to CloudWatch Logs.
 *
 * No user data stored. No PII logged. Events are counts only.
 * No third-party analytics service. No cookies. No tracking pixels.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const VALID_EVENTS = [
  'assessment_completed',
  'assessment_error',
  'pdf_downloaded',
  'pdf_error',
  'start_over',
] as const;

type AnalyticsEvent = (typeof VALID_EVENTS)[number];

interface AnalyticsPayload {
  event: AnalyticsEvent;
  role?: string;
  sensitivity?: string;
  duration_ms?: number;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'POST only.' });
  }

  const body = req.body as Partial<AnalyticsPayload>;

  // Validate event name
  if (!body.event || !VALID_EVENTS.includes(body.event as AnalyticsEvent)) {
    return res.status(400).json({ error: true, message: 'Invalid event.' });
  }

  // Log to CloudWatch — structured JSON for easy querying
  // No PII, no workflow text, no IP addresses. Just the event type and metadata.
  const logEntry = {
    type: 'analytics',
    event: body.event,
    role: body.role || null,
    sensitivity: body.sensitivity || null,
    duration_ms: body.duration_ms || null,
    timestamp: new Date().toISOString(),
  };

  console.log('[analytics]', JSON.stringify(logEntry));

  return res.status(204).end();
}
