/**
 * POST /api/assess — Themis Lex assessment endpoint.
 * One responsibility: validate inputs, assemble prompt, call Bedrock, return structured JSON.
 * See Architecture v1.1 Section 4 for the full API contract.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { validateInput, validateResponse, isValidationError } from '@/lib/validate';
import { assemblePrompt } from '@/lib/prompt';
import { callBedrock, BedrockConfigError } from '@/lib/bedrock';
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

  // Rate limit gate
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

  try {
    // Step 1: Server-side validation — never trust the frontend
    const validationResult = validateInput(req.body);

    if (isValidationError(validationResult)) {
      return res.status(400).json(validationResult);
    }

    const { role, workflow, sensitivity } = validationResult;

    // Step 2: Assemble prompt
    const { systemPrompt, userMessage } = assemblePrompt(
      role,
      workflow,
      sensitivity
    );

    // Step 3: Single Bedrock call at temperature 0.2 (streaming internally)
    const bedrockResult = await callBedrock(systemPrompt, userMessage);

    if (!bedrockResult.success) {
      return res.status(502).json({
        error: true,
        message: bedrockResult.message,
      });
    }

    // Step 4: Validate response structure before returning to client
    if (!validateResponse(bedrockResult.data)) {
      console.error(
        'Bedrock response failed structural validation:',
        JSON.stringify(bedrockResult.data).substring(0, 500)
      );
      return res.status(502).json({
        error: true,
        message: USER_FACING_ERROR,
      });
    }

    // Step 5: Return validated response — no user data stored
    return res.status(200).json(bedrockResult.data);
  } catch (error) {
    // Config error — missing env var. Log specific var server-side,
    // return generic message to client (no leaked internals).
    if (
      error instanceof BedrockConfigError ||
      (error as Error)?.name === 'BedrockConfigError'
    ) {
      console.error(`[config] ${(error as Error).message}`);
      return res.status(500).json({
        error: true,
        message: 'Service is misconfigured. Please contact support.',
      });
    }

    console.error('Unexpected error in /api/assess:', error);
    return res.status(500).json({
      error: true,
      message: USER_FACING_ERROR,
    });
  }
}
