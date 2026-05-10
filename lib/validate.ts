/**
 * Server-side input validation for Themis Lex.
 * One responsibility: validate inputs and API responses.
 * See Architecture v1.1 Section 4 for validation rules.
 */

const ACTIVE_ROLES = ['ja1_2', 'ja3_courtroom', 'jss'] as const;
const VALID_SENSITIVITY = ['low', 'medium', 'high'] as const;
const MIN_WORKFLOW_LENGTH = 120;
const MAX_WORKFLOW_LENGTH = 3000;

type ActiveRole = (typeof ACTIVE_ROLES)[number];
type Sensitivity = (typeof VALID_SENSITIVITY)[number];

export interface ValidatedInput {
  role: ActiveRole;
  workflow: string;
  sensitivity: Sensitivity;
}

export interface ValidationError {
  error: true;
  message: string;
}

export interface CanHelpItem {
  workflow_name: string;
  description: string;
  why_safe: string;
  guardrails: string;
}

export interface MustNotTouchItem {
  workflow_name: string;
  description: string;
  rule: string;
  risk: string;
  instead: string;
}

export interface AssessmentResponse {
  can_help: CanHelpItem[];
  must_not_touch: MustNotTouchItem[];
}

/**
 * Validates the request body from /api/assess.
 * Returns validated input or a user-facing error message.
 * Never returns raw validation details to the client.
 */
export function validateInput(
  body: unknown
): ValidatedInput | ValidationError {
  if (!body || typeof body !== 'object') {
    return {
      error: true,
      message: 'Please fill out all fields before submitting your assessment.',
    };
  }

  const { role, workflow, sensitivity } = body as Record<string, unknown>;

  // Role must be one of the three active values.
  // Reject disabled/stub roles even if client-side is bypassed.
  if (
    typeof role !== 'string' ||
    !(ACTIVE_ROLES as readonly string[]).includes(role)
  ) {
    return {
      error: true,
      message:
        'The selected role is not currently available for assessment. Please choose an active role classification.',
    };
  }

  // Workflow must be a string, minimum 120 characters after trim, maximum 3000.
  if (typeof workflow !== 'string' || workflow.trim().length < MIN_WORKFLOW_LENGTH) {
    return {
      error: true,
      message: `Your workflow description needs at least ${MIN_WORKFLOW_LENGTH} characters for a meaningful assessment. Please add more detail about what you do.`,
    };
  }

  if (workflow.trim().length > MAX_WORKFLOW_LENGTH) {
    return {
      error: true,
      message: `Your workflow description is too long. Please keep it under ${MAX_WORKFLOW_LENGTH} characters (about 500 words) — short and specific descriptions get the most useful guidance.`,
    };
  }

  // Sensitivity must be one of three valid values.
  if (
    typeof sensitivity !== 'string' ||
    !(VALID_SENSITIVITY as readonly string[]).includes(sensitivity)
  ) {
    return {
      error: true,
      message:
        'Please select a data sensitivity level (Low, Medium, or High) before submitting.',
    };
  }

  return {
    role: role as ActiveRole,
    workflow: workflow.trim(),
    sensitivity: sensitivity as Sensitivity,
  };
}

/**
 * Validates the structured JSON response from Bedrock.
 * Checks that both arrays exist, are non-empty, and each item has required fields.
 * Returns true if valid, false if not.
 */
export function validateResponse(data: unknown): data is AssessmentResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const response = data as Record<string, unknown>;

  // Both arrays must exist and be non-empty
  if (!Array.isArray(response.can_help) || response.can_help.length === 0) {
    return false;
  }
  if (
    !Array.isArray(response.must_not_touch) ||
    response.must_not_touch.length === 0
  ) {
    return false;
  }

  // Validate each can_help item has required fields
  for (const item of response.can_help) {
    if (
      typeof item !== 'object' ||
      !item ||
      typeof (item as Record<string, unknown>).workflow_name !== 'string' ||
      typeof (item as Record<string, unknown>).description !== 'string' ||
      typeof (item as Record<string, unknown>).why_safe !== 'string' ||
      typeof (item as Record<string, unknown>).guardrails !== 'string'
    ) {
      return false;
    }
  }

  // Validate each must_not_touch item has required fields
  for (const item of response.must_not_touch) {
    if (
      typeof item !== 'object' ||
      !item ||
      typeof (item as Record<string, unknown>).workflow_name !== 'string' ||
      typeof (item as Record<string, unknown>).description !== 'string' ||
      typeof (item as Record<string, unknown>).rule !== 'string' ||
      typeof (item as Record<string, unknown>).risk !== 'string' ||
      typeof (item as Record<string, unknown>).instead !== 'string'
    ) {
      return false;
    }
  }

  return true;
}

export function isValidationError(
  result: ValidatedInput | ValidationError
): result is ValidationError {
  return 'error' in result && result.error === true;
}
