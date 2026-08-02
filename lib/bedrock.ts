/**
 * AWS Bedrock client wrapper for Themis Lex.
 * One responsibility: send a prompt to Claude via Bedrock and return parsed JSON.
 * Model is configurable via BEDROCK_MODEL_ID env var; falls back to Claude
 * Haiku 4.5 (hardcoded on line 70). See Prompt Spec v1.2 Section 4.
 *
 * Uses InvokeModelWithResponseStreamCommand to collect the response via streaming.
 * This keeps the Lambda process alive during generation (Amplify SSR has a 30s
 * hard timeout). The full response is collected server-side and returned as JSON.
 *
 * max_tokens history: started at 6000 (initial commit), cut to 3000 then 2000
 * chasing the Amplify timeout with Sonnet, raised back to 4000 after the
 * Haiku 4.5 swap made generation fast enough to fit.
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

/**
 * Thrown when a required environment variable is missing at request time.
 * Named error so the API route can distinguish config failure from Bedrock failure.
 * Object.setPrototypeOf is required because tsconfig targets ES5 and
 * subclassing built-ins does not survive downleveling without it.
 */
export class BedrockConfigError extends Error {
  readonly envVar: string;
  constructor(envVar: string) {
    super(`Missing required environment variable: ${envVar}`);
    this.name = 'BedrockConfigError';
    this.envVar = envVar;
    Object.setPrototypeOf(this, BedrockConfigError.prototype);
  }
}

// STUB V2: Two-call differential temperature
// Implementation notes: split assessment into two Bedrock calls with the same system prompt
// and user message but request only one array per call. Call 1 at 0.7 returns can_help only.
// Call 2 at 0.1 returns must_not_touch only. Merge results before returning to client.
// Do not build until v1 is shipped and credit budget allows.

const TEMPERATURE = 0.2;
const MAX_TOKENS = 4000;
const ANTHROPIC_VERSION = 'bedrock-2023-05-31';

interface BedrockSuccess {
  success: true;
  data: unknown;
}

interface BedrockError {
  success: false;
  message: string;
}

type BedrockResult = BedrockSuccess | BedrockError;

// Credential resolution uses the AWS SDK default credential provider chain.
// Production (Amplify Hosting): STS-assumed credentials from the compute
//   role attached at App settings > IAM roles > Compute role. Lambda
//   runtime auto-injects AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and
//   AWS_SESSION_TOKEN.
// Local dev (npm run dev): .env.local values for AWS_ACCESS_KEY_ID and
//   AWS_SECRET_ACCESS_KEY (the SDK reads them via process.env).
// No explicit credentials block needed. The SDK handles both paths.
function createClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
}

/**
 * Sends a single prompt to Claude via Bedrock at temperature 0.2.
 * Uses response streaming to collect chunks (keeps Lambda alive during generation).
 * Returns parsed JSON response or a structured error.
 *
 * Request body follows the Anthropic-on-Bedrock format:
 * - system prompt goes in the top-level "system" field, NOT inside messages
 * - max_tokens set to 4000 to keep generation under Amplify's 30s timeout
 */
export async function callBedrock(
  systemPrompt: string,
  userMessage: string
): Promise<BedrockResult> {
  // BEDROCK_MODEL_ID is inlined by next.config.js at build time, so in
  // production this value is a string literal baked into the bundle and this
  // guard never fires. It still protects local dev and any edge case where
  // the inline does not apply. Layer 1 (next.config.js) is the actual
  // production protection.
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    throw new BedrockConfigError('BEDROCK_MODEL_ID');
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
    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);

    if (!response.body) {
      console.error('Bedrock stream response has no body');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    // Collect all streamed chunks into a single text string
    let fullText = '';

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        const chunkData = JSON.parse(
          new TextDecoder().decode(event.chunk.bytes)
        );

        if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
          fullText += chunkData.delta.text;
        }

        if (chunkData.type === 'message_stop') {
          break;
        }
      }
    }

    if (!fullText) {
      console.error('Bedrock stream produced no text content');
      return {
        success: false,
        message:
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor.",
      };
    }

    // Strip markdown code fences if the model wraps its JSON response in them
    let cleanedText = fullText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    // Parse the model's JSON output
    let assessmentData: unknown;
    try {
      assessmentData = JSON.parse(cleanedText);
    } catch {
      console.error('Model output is not valid JSON. First 500 chars:', cleanedText.substring(0, 500));
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
