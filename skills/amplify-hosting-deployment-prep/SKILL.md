---
name: amplify-hosting-deployment-prep
description: Pre-flight checklist and four undocumented gotchas for deploying Next.js apps to AWS Amplify Hosting, especially apps with API routes that call Bedrock, OpenAI, or other slow upstream services. Use this skill any time the user mentions deploying to Amplify, configuring an Amplify SSR app, IAM compute roles, AWS_ environment variable prefix issues, the AWS Builder ID vs IAM Identity Center distinction for Kiro and AWS billing, or hits a 28-second timeout on Amplify SSR. Especially trigger when the user is starting a new Next.js plus AWS deployment, asks "should I use Amplify," reports an unexpected Lambda timeout on Amplify, or describes credential resolution failing on a deployed Amplify app even though local dev works.
---

# AWS Amplify Hosting deployment prep

This skill prevents four undocumented gotchas that bite developers deploying Next.js apps with SSR and AWS service integrations to Amplify Hosting. The gotchas are platform-specific and do not appear in AWS's quickstart docs. Each one cost the original author of this skill an hour or more.

## When to apply this skill

Apply at the START of any new AWS Amplify Hosting project where:

- The Next.js app has API routes (pages/api/* or app/api/*)
- The API routes call AWS services (Bedrock, S3, DynamoDB, Lambda) OR other slow upstream services (OpenAI, third-party APIs that take >5 seconds)
- The deployment is on Amplify Hosting in SSR/Compute mode (not static export)

Also apply when debugging:

- A 28-30 second hang on a deployed Amplify SSR API route, especially with no error logged from your code
- AccessDenied or credential errors that only appear in production, not local dev
- A Stripe redirect when trying to upgrade Kiro (signal that the user is on AWS Builder ID auth, not IAM Identity Center, which is a separate billing path)

## The decision filter: should the user actually use Amplify SSR?

Before recommending Amplify, ask one question: **will any API route in this app take longer than 25 seconds end-to-end?**

This includes:
- Large LLM responses with structured output (multi-item JSON arrays, long generations)
- PDF generation for complex documents
- Slow third-party APIs
- Heavy database queries
- Large file processing

**If yes**: do not recommend Amplify SSR. The 28-30 second gateway timeout is a hard ceiling that streaming workarounds cannot defeat (see Gotcha 4 below). Recommend instead:
- Vercel Pro (60s timeout, native Next.js streaming)
- AWS App Runner (configurable up to 120s)
- Lambda Function URL with response streaming enabled (15-minute timeout, true server-sent streaming)
- Separate Lambda behind API Gateway (60s timeout)

**If no**: Amplify SSR is a reasonable default. Walk the user through the setup checklist below.

This question matters more than any other architectural decision. Most Amplify gotchas can be worked around. The 25-second wall cannot.

## Day-one setup checklist for new Amplify SSR projects

Have the user complete all of these BEFORE writing deployment-dependent code. Doing them upfront avoids three of the four gotchas before they bite.

### 1. Set up the IAM compute role with the correct trust policy

The compute role's trust policy MUST include both `amplify.amazonaws.com` (the build service) AND `lambda.amazonaws.com` (the runtime Lambda). AWS docs only show the first. Without `lambda.amazonaws.com`, the runtime Lambda silently fails to assume the role at request time.

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

Attach the application's actual permission policy (Bedrock, S3, etc.) to this role. Keep permissions scoped to least privilege.

### 2. Attach the role at the BRANCH level, not just the app level

Amplify Console has two attachment slots, and they do different things:

- App settings > IAM roles > Compute role > **Default role** (app-level — controls BUILD environment only)
- App settings > IAM roles > Compute role > **Branch overrides** (per-branch — controls RUNTIME environment)

The runtime Lambda only picks up the role from branch-level attachment. Setting Default role and stopping is the most common mistake. Always set per-branch.

CLI verification:
```bash
aws amplify get-app --app-id YOUR_APP_ID
aws amplify get-branch --app-id YOUR_APP_ID --branch-name main
```

If `computeRoleArn` shows on the app but not on the branch, fix it:
```bash
aws amplify update-branch \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --compute-role-arn arn:aws:iam::YOUR_ACCOUNT:role/YOUR_ROLE_NAME
```

### 3. Skip the env-var-credentials approach entirely

Do not try to set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Amplify Console environment variables. Amplify reserves the `AWS_` prefix and will silently block these from reaching the runtime. AWS docs do not mention this restriction until you hit it.

Use the compute role pattern instead. In application code, let the AWS SDK use the default credential provider chain. No explicit credentials block. The SDK will find credentials from `.env.local` in local dev and from the Lambda runtime's STS-assumed credentials in production.

```typescript
// CORRECT — uses default credential provider chain
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// WRONG — will fail on Amplify because AWS_ACCESS_KEY_ID can't be user-set
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});
```

### 4. Set output: 'standalone' if reading from public/ server-side

If server code reads files from `public/` (fonts for `@react-pdf/renderer`, images for server rendering, anything via `fs.readFileSync(path.join(process.cwd(), 'public', ...))`), set `output: 'standalone'` in `next.config.js` BEFORE the first deploy:

```js
const nextConfig = {
  output: 'standalone',
  // rest of config
};
```

Without standalone mode, the `public/` folder may not be included in the Lambda function bundle. The user will see file-not-found errors for assets that clearly exist in the repo. Standalone mode explicitly bundles `public/` into the Lambda artifact.

### 5. Plan for cold starts in the UX

Amplify SSR Lambdas have cold starts of 3-8 seconds after periods of inactivity. The first request to the app after idle will be slow. Build a loading state for ALL user-facing routes, not just submit/loading routes. Do not show a blank page during cold start.

## The four gotchas: symptoms and fixes

If the user skipped the setup checklist or is debugging an existing Amplify SSR app, work through these in order. They have very similar surface symptoms (28-second hang, no error logged) but different root causes.

### Gotcha 1: Trust policy missing lambda.amazonaws.com

**Symptom**: API routes hang for exactly 28 seconds. No error logged from the user's catch blocks. The IAM Console may show "Last activity" on the role, making it look like the role IS being assumed (it is — by the build service, not the runtime).

**Why it happens**: The runtime Lambda introduces itself as `lambda.amazonaws.com`. If that principal isn't in the trust policy, the AWS SDK can't assume the role and walks the credential provider chain looking for fallbacks. With no fallbacks, it hangs until the gateway kills the request.

**Fix**: Add `lambda.amazonaws.com` to the trust policy's `Principal.Service` array. See setup step 1.

### Gotcha 2: Role attached at app level, not branch level

**Symptom**: Identical to Gotcha 1. 28-second hang, no error from user code.

**Why it happens**: The Default role slot in Amplify Console only applies to the build environment. The runtime Lambda needs a branch-level attachment to pick up credentials at request time.

**Fix**: Use `aws amplify update-branch` to set `computeRoleArn` at the branch level. See setup step 2.

### Gotcha 3: 28-30 second hard gateway timeout that cannot be raised

**Symptom**: API routes hang for 28-30 seconds EVEN after fixing Gotchas 1 and 2. CloudWatch shows the upstream call (Bedrock, OpenAI, etc.) started successfully. The Lambda dies mid-response, not before reaching the upstream service.

**Why it happens**: Amplify Hosting SSR has a hard gateway timeout that cannot be increased through any setting AWS exposes. Tracked as open issue #3223 on aws-amplify/amplify-hosting since January 2023, no fix announced.

**Fix**: This is a platform constraint. Two real paths:
1. Reduce upstream response time below 25 seconds (drop max_tokens for LLMs, simplify prompts, lighter queries)
2. Move the slow endpoint off Amplify SSR entirely (Vercel Pro, App Runner, Lambda Function URL, or separate Lambda plus API Gateway)

Switching the SDK to streaming responses (`InvokeModelWithResponseStreamCommand` for Bedrock) does NOT solve this on Pages API routes (see Gotcha 4).

### Gotcha 4: Pages API routes buffer responses, defeating streaming

**Symptom**: After switching to streaming SDK calls, API routes still hang 28-30 seconds. CloudWatch shows chunks arriving inside the Lambda. The client only sees the timeout.

**Why it happens**: Next.js Pages API routes buffer the response. `res.write(chunk)` does not flush to the gateway in real-time. The full response is serialized at `res.end()`. By that point, the gateway has already cut the connection.

**Fix**: Streaming alone will not save the user on Pages API routes. App Router route handlers using the standard Web `Response` object with a `ReadableStream` body have better streaming behavior, but the gateway timeout still caps total time. The actual fix is the same as Gotcha 3: reduce response time OR move the endpoint off Amplify SSR.

## Diagnostic shortcuts for debugging deployed Amplify apps

### Where to find logs

- **Build logs**: Amplify Console > the app > Hosting > Build history > pick a build
- **Runtime logs**: AWS CloudWatch > Log groups > search for the app ID > pattern is typically `/aws/amplify/<app-id>/<branch>/ssr`

Both URLs are needed during debugging. The build log shows what the build agent did. The runtime log shows what the Lambda did when serving requests.

### Quick state checks

```bash
# Is the compute role attached at the branch level?
aws amplify get-branch --app-id YOUR_APP_ID --branch-name main \
  --query "branch.computeRoleArn"

# Does the role's trust policy include lambda.amazonaws.com?
aws iam get-role --role-name YOUR_ROLE_NAME \
  --query "Role.AssumeRolePolicyDocument"

# What permissions does the policy actually grant?
aws iam list-attached-role-policies --role-name YOUR_ROLE_NAME
```

### When "Redeploy this version" does not pick up changes

Amplify's "Redeploy this version" button replays the existing build artifact. It does NOT pick up changes to IAM role attachments or environment variables. For configuration changes to take effect, push a fresh commit (any change, even a single character in a comment) to trigger a new build that re-reads world state.

## AWS Builder ID vs IAM Identity Center (relevant when also using Kiro)

If the user mentions Kiro billing, applying AWS credits to Kiro, or being redirected to Stripe when trying to upgrade Kiro, this section applies.

Kiro has two authentication paths with completely different billing:

- **AWS Builder ID or social login (GitHub, Google)**: Kiro charges flow through Stripe directly. AWS account credits do NOT apply. This is the default for individual users.
- **AWS IAM Identity Center**: Kiro charges flow through the AWS account. AWS account credits apply automatically. Required for using AWS startup credits or hackathon credits with Kiro.

To switch from Builder ID billing to AWS-account billing:

1. Set up IAM Identity Center on the AWS account (create instance, user, permission set, assign user to AWS account with AdministratorAccess or equivalent)
2. Create a Kiro profile in the AWS Kiro Console (search "Kiro" in AWS Console > Sign up for Kiro)
3. Subscribe the IAM Identity Center user to a Kiro tier (Pro/Pro+/Power) via Kiro Console > Users & Groups > Add user
4. In the Kiro app, sign out of any Builder ID session, then sign in via "Your organization" using the IAM Identity Center start URL

A Stripe redirect when trying to upgrade Kiro is the signal that the user is on the Builder ID path. They should stop and switch paths if they want AWS credits to apply.

This setup is non-trivial — typically 30-60 minutes including waiting for IAM Identity Center user activation emails. AWS does not market this clearly. The Kiro pricing page implies AWS credits "just work," but they only work via the IAM Identity Center path.

## Why none of this is in the obvious docs

All four Amplify gotchas are filed as open issues on aws-amplify/amplify-hosting. The official AWS docs cover the build pathway clearly but treat the runtime pathway as an implementation detail. The combination of running a slow LLM call with structured output on Amplify SSR is rare enough that most developers never hit any of this. The few who do hit all four in succession.

The Builder ID vs IAM Identity Center distinction for Kiro is similarly buried — it appears in the IAM Identity Center docs and the Kiro enterprise docs, but not in the Kiro pricing page that most users see first.

This skill exists because the original author lost more than half a day to these gotchas. The intent is to bring future debugging time down from hours to under 30 minutes.

## Sources

- AWS blog: IAM Compute Roles for Server-Side Rendering with AWS Amplify Hosting
- aws-amplify/amplify-hosting GitHub issue #3223 (28-second timeout, open since January 2023)
- AWS docs: Adding an SSR Compute role to allow access to AWS resources
- AWS docs: Making environment variables accessible to server-side runtimes
- Kiro docs: Subscribing your team to Kiro
- Kiro docs: How Kiro works with identity and access management (IAM)
