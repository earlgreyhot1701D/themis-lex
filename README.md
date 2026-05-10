# Themis Lex

AI readiness self-check for California Superior Court staff. Built for the Women in AI Accelerator (Spring 2026).

A court employee enters their role, describes their workflow, and selects a data sensitivity level. The tool returns where AI can help and where it must not, grounded in California judicial branch governance principles. Output downloads as a PDF the user can hand to their supervisor.

## Stack

Next.js 14, TypeScript, Claude Sonnet 4.6 via AWS Bedrock, server-side PDF via `@react-pdf/renderer`, deployed on AWS Amplify Hosting (SSR compute mode).

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in your AWS access keys and Bedrock model ID in .env.local
npm run dev
```

## Documentation

- `themis-lex-prd-v1_3.md` — locked product requirements doc
- `DEPLOY.md` — deployment, environment variables, IAM compute role setup, smoke test checklist
- `themis-lex-prompt-spec.md` — prompt assembly spec (system prompt, role context, sensitivity rules)

## Heads up: AWS Amplify Hosting + Bedrock gotchas

If you're forking this project to deploy your own version, there are four AWS gotchas that cost us more than half a day of debugging. AWS docs underspecify all of them. Hopefully this saves you the same time.

### Gotcha 1: The trust policy needs two principals, not one

Most AWS docs for Amplify SSR compute roles show this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "amplify.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

That's only enough for the build service to assume the role. The runtime Lambda that serves your API routes runs as `lambda.amazonaws.com` and needs to be on the trust list too. Use this:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": ["amplify.amazonaws.com", "lambda.amazonaws.com"]
    },
    "Action": "sts:AssumeRole"
  }]
}
```

**Symptom if you miss this:** API routes hang for exactly 28 seconds, then Lambda kills the request with "Request timed out." No error logged from your code, because the AWS SDK never reaches your service. It's stuck in the credential provider chain looking for a role it can't assume.

### Gotcha 2: Attach the compute role at the BRANCH level, not just the app level

Amplify Console has two places to attach a compute role:

1. App settings > IAM roles > Compute role > **Default role** (app-level)
2. App settings > IAM roles > Compute role > **Branch overrides** (per-branch)

The "Default role" only applies to the build environment (CodeBuild). The runtime Lambda that serves your traffic only picks up the role from a branch-level attachment. Set it on every branch you intend to deploy.

Verify via CLI:

```bash
aws amplify get-app --app-id YOUR_APP_ID
aws amplify get-branch --app-id YOUR_APP_ID --branch-name main
```

If `computeRoleArn` shows on the app but not on the branch, you've hit this gotcha. Fix:

```bash
aws amplify update-branch \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --compute-role-arn arn:aws:iam::YOUR_ACCOUNT:role/YOUR_ROLE_NAME
```

Symptom is the same as Gotcha 1: 28-second hang on API routes, no error logged.

### Gotcha 3: Amplify SSR Lambdas have a 28-second hard timeout that cannot be raised

After fixing both auth issues above, you might still see API routes time out at exactly 28 seconds. This is not a configuration mistake on your side. Amplify Hosting SSR Lambdas have a 28-second invocation timeout that cannot be increased, regardless of your AWS account's normal Lambda timeout settings.

This is tracked as an open issue on aws-amplify/amplify-hosting since January 2023 (issue #3223). It has 59+ thumbs-up and no announced fix as of this writing.

If your API route involves a slow upstream call (large LLM responses, complex database queries, third-party APIs that take 30+ seconds), the Lambda will be killed mid-response. For Bedrock specifically, large prompts that produce multi-item structured JSON outputs can routinely exceed 30 seconds. Themis Lex calls hit ~42 seconds.

**The fix is response streaming.** Switch from `InvokeModelCommand` to `InvokeModelWithResponseStreamCommand` on the server, then stream the response back to the client as it generates. The Lambda stays alive as long as it is actively sending data. First token typically arrives in 2-5 seconds, well within the 28-second window, and the active stream prevents the Lambda from idling into the timeout.

This change touches three places:

- **IAM policy:** add `bedrock:InvokeModelWithResponseStream` to the actions list alongside `bedrock:InvokeModel`.
- **Server (`lib/bedrock.ts` and your API route):** swap to the streaming SDK command, then write chunks to the response as they arrive from Bedrock.
- **Client:** switch from `fetch().json()` to reading the response body as a `ReadableStream`, accumulate chunks, parse the final JSON.

**Symptom if you miss this:** API routes hang for exactly 28 seconds, get killed with "Request timed out." Unlike Gotchas 1 and 2, you will see partial logs in CloudWatch showing the Bedrock call started successfully (credential resolution worked, the SDK call went through). The Lambda dies mid-response, not before the SDK reaches Bedrock.

### Gotcha 4: Next.js Pages API routes don't truly stream on Amplify Hosting

After implementing the streaming fix from Gotcha 3, you may find your API routes still time out at the gateway. The Lambda is receiving Bedrock chunks correctly via async iteration, your code is calling `res.write(chunk)` for each one, but the gateway still kills the connection.

The reason: Next.js Pages API routes buffer the response. The chunks you write via `res.write()` are not flushed to the Amplify gateway in real-time. They sit in Next.js's internal HTTP handling until `res.end()` is called, at which point the full response is serialized and sent at once. By that time, the gateway has already cut the connection.

App Router route handlers using the standard Web `Response` object with a `ReadableStream` body have better streaming behavior, but the gateway timeout still caps total time. Streaming alone does not defeat the timeout on Amplify SSR if the full response exceeds it.

**Symptom if you miss this:** API routes hang for 28-30 seconds even after switching to streaming SDK calls. CloudWatch logs may show Bedrock chunks being received inside the Lambda, but the client only sees the platform timeout. Switching from `InvokeModel` to `InvokeModelWithResponseStream` does not fix the timeout — it just changes where in the call stack the timeout hits.

**The honest fix paths:**

Reduce response time below the gateway window. For LLMs, this means dropping `max_tokens`, simplifying prompts, asking for fewer items in structured outputs. We landed on `max_tokens=3000` for Themis Lex, which kept Bedrock generation reliably under 25 seconds.

If response time can't be reduced, move the slow endpoint off Amplify SSR. Real options: Lambda Function URL with response streaming enabled (15-minute timeout, true server-sent streaming), separate Lambda behind API Gateway (60-second timeout), or migrate hosting to Vercel Pro (60s timeout, first-class Next.js streaming support).

For LLM-heavy workloads with synchronous structured output, Vercel Pro is generally a better hosting fit than Amplify SSR. Amplify wins for fast API routes, content sites, and standard CRUD apps. It's the wrong default for any workload where a single response routinely exceeds 25 seconds.

### Why none of these gotchas appear clearly in the obvious places

All four are filed as open issues on aws-amplify/amplify-hosting. The official docs cover the build pathway clearly but treat the runtime pathway as an implementation detail. You are not the first dev to hit any of them. Just the cost of doing business on Amplify Hosting in Spring 2026.

---

AI assisted. Human approved. Powered by NLP.
