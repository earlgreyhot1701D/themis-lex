/**
 * AWS Bedrock client wrapper for Themis Lex.
 * One responsibility: send a prompt to Claude Sonnet via Bedrock and return parsed JSON.
 * See Prompt Spec v1.2 Section 4 for temperature and call pattern.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// STUB V2: Two-call differential temperature
// Implementation notes: split assessment into two Bedrock calls with the same system prompt
// and user message but request only one array per call. Call 1 at 0.7 returns can_help only.
// Call 2 at 0.1 returns must_not_touch only. Merge results before returning to client.
// Do not build until v1 is shipped and credit budget allows.

const TEMPERATURE = 0.2;
const MAX_TOKENS = 6000;
const ANTHROPIC_VERSION = 'bedrock-2023-05-31';

/**
 * Fail-fast check for required AWS environment variables.
 * Throws a clear error at first call if any are missing.
 */
function validateEnvVars(): void {
  const required = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'BEDROCK_MODEL_ID',
  ];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ''
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required AWS environment variables: ${missing.join(', ')}. Check Amplify Console environment configuration.`
    );
  }
}

interface BedrockSuccess {
  success: true;
  data: unknown;
}

interface BedrockError {
  success: false;
  message: string;
}

type BedrockResult = BedrockSuccess | BedrockError;

/**
 * Creates a Bedrock runtime client using server-side environment variables.
 * Credentials are never exposed to the client.
 */
function createClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Sends a single prompt to Claude Sonnet via Bedrock at temperature 0.2.
 * Returns parsed JSON response or a structured error.
 *
 * Request body follows the Anthropic-on-Bedrock format:
 * - system prompt goes in the top-level "system" field, NOT inside messages
 * - max_tokens set to 6000 per Prompt Spec v1.2 to avoid truncating multi-item array responses
 */
export async function callBedrock(
  systemPrompt: string,
  userMessage: string
): Promise<BedrockResult> {
  const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-6';

  // Fail-fast if credentials are missing
  try {
    validateEnvVars();
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message:
        "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
    };
  }

  const requestBody = {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  };

  try {
    const client = createClient();
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);

    // Parse the response body
    const responseBody = new TextDecoder().decode(response.body);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      console.error('Bedrock response is not valid JSON');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    // Extract the text content from the Anthropic response format
    const content = parsed.content as Array<{ type: string; text: string }> | undefined;
    if (!content || !Array.isArray(content) || content.length === 0) {
      console.error('Bedrock response missing content array');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    const textBlock = content.find((block) => block.type === 'text');
    if (!textBlock || typeof textBlock.text !== 'string') {
      console.error('Bedrock response missing text block');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    // Parse the model's JSON output
    let assessmentData: unknown;
    try {
      assessmentData = JSON.parse(textBlock.text);
    } catch {
      console.error('Model output is not valid JSON');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    return {
      success: true,
      data: assessmentData,
    };
  } catch (error) {
    console.error('Bedrock API call failed:', error);
    return {
      success: false,
      message:
        "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
    };
  }
}
