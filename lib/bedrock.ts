/**
 * AWS Bedrock client wrapper for Themis Lex.
 * One responsibility: send a prompt to Claude Sonnet via Bedrock and return parsed JSON.
 * See Prompt Spec v1.2 Section 4 for temperature and call pattern.
 *
 * Uses InvokeModelWithResponseStreamCommand to keep the Lambda alive during
 * generation. Amplify Hosting SSR has a hard 28-second timeout — streaming
 * keeps the connection active because the Lambda is receiving data, not
 * waiting silently. The full response is collected server-side and returned
 * as a single JSON payload to the client.
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

// STUB V2: Two-call differential temperature
// Implementation notes: split assessment into two Bedrock calls with the same system prompt
// and user message but request only one array per call. Call 1 at 0.7 returns can_help only.
// Call 2 at 0.1 returns must_not_touch only. Merge results before returning to client.
// Do not build until v1 is shipped and credit budget allows.

const TEMPERATURE = 0.2;
const MAX_TOKENS = 6000;
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
 * Sends a single prompt to Claude Sonnet via Bedrock at temperature 0.2.
 * Uses response streaming to keep the Lambda alive during generation.
 * Collects all chunks into a complete response, then parses the JSON.
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

        // Anthropic streaming format: content_block_delta events contain text
        if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
          fullText += chunkData.delta.text;
        }

        // message_stop signals end of generation
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

    // Parse the model's JSON output
    let assessmentData: unknown;
    try {
      assessmentData = JSON.parse(fullText);
    } catch {
      console.error('Model output is not valid JSON. First 500 chars:', fullText.substring(0, 500));
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
