/**
 * POST /api/pdf — Themis Lex PDF generation endpoint.
 * One responsibility: accept assessment results, generate PDF, stream to client.
 * See Architecture v1.1 Section 4 for the full API contract.
 *
 * No user data stored after the file is streamed.
 * No client-side canvas. No jsPDF. No browser-print fallback.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generatePdf } from '@/lib/pdf';
import type { PdfInput } from '@/lib/pdf';
import { checkRateLimit } from '@/lib/rateLimit';

const USER_FACING_ERROR =
  "We weren't able to generate your PDF report. Please try again. If the issue continues, you can take a screenshot of your results as a temporary alternative.";

/**
 * Validates the PDF request body has all required fields.
 * Checks each item in both arrays for required fields.
 */
function validatePdfInput(body: unknown): body is PdfInput {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  if (typeof b.role_label !== 'string' || b.role_label.length === 0) return false;
  if (typeof b.sensitivity_label !== 'string' || b.sensitivity_label.length === 0) return false;
  if (typeof b.timestamp !== 'string' || b.timestamp.length === 0) return false;
  if (!Array.isArray(b.can_help) || b.can_help.length === 0) return false;
  if (!Array.isArray(b.must_not_touch) || b.must_not_touch.length === 0) return false;

  // Validate each can_help item has required fields
  for (const item of b.can_help) {
    if (!item || typeof item !== 'object') return false;
    const it = item as Record<string, unknown>;
    if (typeof it.workflow_name !== 'string' || it.workflow_name.length === 0) return false;
    if (typeof it.description !== 'string' || it.description.length === 0) return false;
    if (typeof it.why_safe !== 'string' || it.why_safe.length === 0) return false;
    if (typeof it.guardrails !== 'string' || it.guardrails.length === 0) return false;
  }

  // Validate each must_not_touch item has required fields
  for (const item of b.must_not_touch) {
    if (!item || typeof item !== 'object') return false;
    const it = item as Record<string, unknown>;
    if (typeof it.workflow_name !== 'string' || it.workflow_name.length === 0) return false;
    if (typeof it.description !== 'string' || it.description.length === 0) return false;
    if (typeof it.rule !== 'string' || it.rule.length === 0) return false;
    if (typeof it.risk !== 'string' || it.risk.length === 0) return false;
    if (typeof it.instead !== 'string' || it.instead.length === 0) return false;
  }

  return true;
}

/**
 * Validates the PDF request body has all required fields (lenient — missing description allowed).
 * Used as fallback when strict validation fails, to support pre-description assessment data.
 */
function validatePdfInputLenient(body: unknown): body is PdfInput {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  if (typeof b.role_label !== 'string' || b.role_label.length === 0) return false;
  if (typeof b.sensitivity_label !== 'string' || b.sensitivity_label.length === 0) return false;
  if (typeof b.timestamp !== 'string' || b.timestamp.length === 0) return false;
  if (!Array.isArray(b.can_help) || b.can_help.length === 0) return false;
  if (!Array.isArray(b.must_not_touch) || b.must_not_touch.length === 0) return false;

  return true;
}

/**
 * Maps role key to a filesystem-safe slug for the filename.
 */
function roleSlug(roleLabel: string): string {
  return roleLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST only
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: true,
      message: 'This endpoint only accepts POST requests.',
    });
  }

  const rateLimit = checkRateLimit(req, 'pdf');
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
    // Validate input — strict check requires all fields including description
    if (!validatePdfInput(req.body)) {
      // Fall back to lenient check — if basic structure is valid but descriptions missing,
      // give a specific message asking user to re-run assessment
      if (validatePdfInputLenient(req.body)) {
        return res.status(400).json({
          error: true,
          message: 'Your assessment results are missing some required information. Please run a new assessment and try downloading again.',
        });
      }
      return res.status(400).json({
        error: true,
        message: 'Missing required fields for PDF generation.',
      });
    }

    const input: PdfInput = req.body;

    // Generate PDF
    const pdfBuffer = await generatePdf(input);

    // Build filename: themis-lex-assessment-{role}-{date}.pdf
    const dateStr = new Date(input.timestamp).toISOString().split('T')[0];
    const slug = roleSlug(input.role_label);
    const filename = `themis-lex-assessment-${slug}-${dateStr}.pdf`;

    // Stream PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    return res.status(500).json({
      error: true,
      message: USER_FACING_ERROR,
    });
  }
}
