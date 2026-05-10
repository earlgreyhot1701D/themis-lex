/**
 * POST /api/assess — Themis Lex assessment endpoint (streaming).
 * One responsibility: validate inputs, assemble prompt, stream Bedrock response to client.
 * See Architecture v1.1 Section 4 for the full API contract.
 *
 * Streams text chunks from Bedrock directly to the client via res.write().
 * This keeps the Amplify Hosting gateway alive (28-second hard timeout applies
 * to time-to-first-byte, not total response time). The client accumulates
 * chunks and parses the final JSON.
 *
 * Validation approach: input validation happens server-side BEFORE streaming
 * starts (rate limit, role, workflow length, sensitivity). Response structural
 * validation moves to the client after accumulation — we cannot validate the
 * full JSON server-side without waiting for the complete response, which would
 * re-introduce the timeout. The prompt instructs the model to return valid JSON,
 * and the client validates structure before rendering.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { validateInput, isValidationError } from '@/lib/validate';
import { assemblePrompt } from '@/lib/prompt';
import { streamBedrock } from '@/lib/bedrock';
import { checkRateLimit } from '@/lib/rateLimit';

const USER_FACING_ERROR =
  "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST only — reject other methods
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: true,
      message: 'This endpoint only accepts POST requests.',
    });
  }

  // Rate limit gate — BEFORE streaming starts
  const rateLimit = checkRateLimit(req, 'assess');
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    return res.status(429).json({
      error: true,
      message: USER_FACING_ERROR,
    });
  }

  // Input validation — BEFORE streaming starts
  const validationResult = validateInput(req.body);
  if (isValidationError(validationResult)) {
    return res.status(400).json(validationResult);
  }

  const { role, workflow, sensitivity } = validationResult;

  // Assemble prompt
  const { systemPrompt, userMessage } = assemblePrompt(role, workflow, sensitivity);

  // Start streaming response to client
  // Content-Type is text/plain because we're sending raw text chunks that
  // the client accumulates into JSON. NOT application/json (that implies
  // a single complete JSON document).
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200);

  try {
    for await (const chunk of streamBedrock(systemPrompt, userMessage)) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error('Bedrock streaming failed:', error);
    // If we haven't sent any data yet, we can still send an error response.
    // If we've already started streaming, the client will get a truncated
    // response and handle the JSON parse failure gracefully.
    if (!res.headersSent) {
      return res.status(502).json({
        error: true,
        message: USER_FACING_ERROR,
      });
    }
    // Headers already sent — write an error marker the client can detect
    res.write('\n\n__STREAM_ERROR__');
    res.end();
  }
}
