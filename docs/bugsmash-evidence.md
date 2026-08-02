# Bugsmash Evidence Report

Gathered from the git history and current codebase of `themis-lex` on 2026-05-24.
Read-only investigation — no files were modified.

---

## 1. The Credential Bug

**Finding:** The initial commit passed an explicit `credentials` object with empty-string fallbacks to `BedrockRuntimeClient`. This bypassed the SDK credential provider chain. The fix removed the `credentials` block entirely.

**Before (commit `c136357`, 2026-05-09 19:06:37 -0700):**

```typescript
function createClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}
```

**After (commit `e053255`, 2026-05-10 03:24:31 +0000, message: "refactor: migrate Bedrock auth to IAM compute role"):**

```typescript
function createClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
}
```

**File:** `lib/bedrock.ts`, current line 53.

**Other AWS SDK clients in the repo:** None found. `lib/bedrock.ts` is the only file that instantiates an AWS SDK client.

**Status:** VERIFIED

---

## 2. The Model Swap

**Finding:** Model switched from Claude Sonnet 4.6 to Claude Haiku 4.5 in commit `4e6bc55` (2026-05-10 07:00:08 -0700, message: "fix: switch to Claude Haiku 4.5 to fit Amplify 30s timeout").

**Model ID references today:**

| File | Line | Value |
|------|------|-------|
| `lib/bedrock.ts` | 70 | `'us.anthropic.claude-haiku-4-5-20251001-v1:0'` (hardcoded fallback) |
| `next.config.js` | 23 | `process.env.BEDROCK_MODEL_ID` (forwarded to runtime) |

**Yes, a hardcoded fallback model ID still exists** in `lib/bedrock.ts` line 70:
```typescript
const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
```

**max_tokens progression:**

| Commit | SHA | Date | Value |
|--------|-----|------|-------|
| Initial commit | `c136357` | 2026-05-09 19:06:37 | `6000` |
| First reduction | `f010466` | 2026-05-10 06:48:52 | `3000` |
| Second reduction | `5b3f935` | 2026-05-10 06:52:57 | `2000` |
| Model swap (Haiku) | `4e6bc55` | 2026-05-10 07:00:08 | `4000` |
| Current | — | — | `4000` |

**Your draft says 6000 before.** Confirmed: initial commit had `MAX_TOKENS = 6000`. Current value is `4000` (bumped back up when Haiku was fast enough).

**Status:** VERIFIED

---

## 3. The Env Var Handling

**Current `next.config.js` (verbatim):**

```javascript
// STUB V2: Content-Security-Policy ships in REPORT-ONLY mode for the MVP.
// [full comment block omitted for brevity — see file for exact text]

const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
  },
  async headers() { /* security headers */ },
};

module.exports = nextConfig;
```

**Every `process.env` reference at runtime, grouped by file:**

| File | Variable | Fallback |
|------|----------|----------|
| `lib/bedrock.ts:53` | `AWS_REGION` | `'us-east-1'` |
| `lib/bedrock.ts:70` | `BEDROCK_MODEL_ID` | `'us.anthropic.claude-haiku-4-5-20251001-v1:0'` |
| `app/page.tsx:22` | `NEXT_PUBLIC_APP_VERSION` | `'0.4'` |
| `next.config.js:23` | `BEDROCK_MODEL_ID` | (forwarded, no fallback at this layer) |

**Does `amplify.yml` write to `.env.production`?** No. The build spec contains only `npm ci` and `npm run build`. No env file generation.

**Commit where `next.config.js` env block was added:** `800a917` (2026-05-09 22:40:57 -0700, message: "fix: forward BEDROCK_MODEL_ID to SSR runtime via next.config.js env").

**Status:** VERIFIED

---

## 4. The Streaming Attempt

**Finding:** `InvokeModelWithResponseStreamCommand` landed in multiple committed versions and is still in the current codebase.

**First appearance:** Commit `7a6dd1d` (2026-05-09 22:50:49 -0700), message: "fix: switch to InvokeModelWithResponseStreamCommand to beat 28s Lambda timeout". This commit only changed `lib/bedrock.ts` — it collected chunks server-side and still returned a single JSON response via `callBedrock()`. The route handler (`pages/api/assess.ts`) was unchanged.

**Full client-streaming attempt:** Commit `b744d34` (2026-05-10 06:37:07 -0700), message: "fix: end-to-end response streaming to beat Amplify 28s gateway timeout". This commit changed three files:
- `lib/bedrock.ts` — exported `streamBedrock()` as an async generator yielding text chunks
- `pages/api/assess.ts` — set `Content-Type: text/plain`, `Transfer-Encoding: chunked`, piped via `res.write()` per chunk
- `app/page.tsx` — used `response.body.getReader()` to read chunks client-side

**This was then reverted** in commit `f010466` (2026-05-10 06:48:52 -0700) back to the collect-then-return pattern because Pages API route buffering meant the gateway still timed out.

**The route is a Pages API route:** `pages/api/assess.ts` (not App Router). This is confirmed in all commits. The path has never been `app/api/.../route.ts`.

**Current state:** `InvokeModelWithResponseStreamCommand` is used in the current `lib/bedrock.ts` to collect chunks server-side (keeps Lambda alive during generation), but the HTTP response to the client is a single JSON payload via `res.status(200).json()` in `pages/api/assess.ts`.

**Your article's claim about Pages Router buffering matches reality.** The streaming-to-client approach failed specifically because Next.js Pages API routes buffer the response until `res.end()` is called, so the Amplify gateway never received bytes before the timeout.

**Status:** VERIFIED

---

## 5. IAM and Infra Artifacts

**Trust policy JSON in the repo:** No standalone JSON file. Trust policy is documented narratively in:
- `DEPLOY.md` line 27: "Trust policy: allows the `amplify.amazonaws.com` service principal to call `sts:AssumeRole`."
- `README.md` lines 179-211: Full before/after trust policy JSON with both principals explained.

**IAM policy JSON in the repo:** No standalone JSON file. Policy documented narratively in:
- `README.md` lines 280-295: Full IAM policy JSON including `aws-marketplace` permissions.

**CloudFormation/CDK/Terraform:** None found anywhere in the repo.

**Compute role setup documentation:** `DEPLOY.md` and `README.md` both document it. `README.md` has the most complete treatment (Section: "Six Gotchas").

**`aws-marketplace` / `ViewSubscriptions` / `Subscribe` references:**
- `README.md` line 289: `"aws-marketplace:ViewSubscriptions"`
- `README.md` line 290: `"aws-marketplace:Subscribe"`

Nowhere else in the codebase.

**Status:** VERIFIED

---

## 6. Timeline

**First commit:** `c136357` — 2026-05-09 19:06:37 -0700 — "Initial commit: Themis Lex MVP"

**First deploy-related commit:** `e053255` / `792b94f` — 2026-05-09 20:31:08 -0700 / 2026-05-10 03:24:31 +0000 — "refactor: migrate Bedrock auth to IAM compute role" (appears twice with different SHAs — likely a rebase or cherry-pick)

**All commits from first deploy attempt to model swap:**

| # | SHA | Timestamp | Message |
|---|-----|-----------|---------|
| 1 | `792b94f` | 2026-05-09 20:31:08 -0700 | refactor: migrate Bedrock auth to IAM compute role |
| 2 | `e053255` | 2026-05-10 03:24:31 +0000 | refactor: migrate Bedrock auth to IAM compute role |
| 3 | `1da81d1` | 2026-05-09 22:29:32 -0700 | diag: log credential env vars at runtime (booleans only, remove after fix) |
| 4 | `800a917` | 2026-05-09 22:40:57 -0700 | fix: forward BEDROCK_MODEL_ID to SSR runtime via next.config.js env |
| 5 | `7a6dd1d` | 2026-05-09 22:50:49 -0700 | fix: switch to InvokeModelWithResponseStreamCommand to beat 28s Lambda timeout |
| 6 | `2e23c29` | 2026-05-10 06:28:20 -0700 | fix: remove unused type export that broke isolatedModules build |
| 7 | `b744d34` | 2026-05-10 06:37:07 -0700 | fix: end-to-end response streaming to beat Amplify 28s gateway timeout |
| 8 | `f010466` | 2026-05-10 06:48:52 -0700 | fix: reduce max_tokens to 3000 to fit Amplify 30s timeout |
| 9 | `5b3f935` | 2026-05-10 06:52:57 -0700 | fix: reduce max_tokens to 2000 — 3000 still exceeded 30s timeout |
| 10 | `4e6bc55` | 2026-05-10 07:00:08 -0700 | fix: switch to Claude Haiku 4.5 to fit Amplify 30s timeout |

**Span:** First deploy attempt at 2026-05-09 20:31 -0700 to model swap at 2026-05-10 07:00 -0700 = approximately 10.5 hours. The bulk of the debugging (commits 3-10) occurred between 22:29 on May 9 and 07:00 on May 10 — an 8.5-hour overnight debugging session.

**Status:** VERIFIED

---

## 7. Response Timing

**Finding:** No benchmark script, timing instrumentation, or automated latency measurement exists in the repo. The `duration_ms` field in the analytics endpoint (`pages/api/analytics.ts`) measures client-side elapsed time (from fetch start to JSON parse complete) — this includes network round-trip, not just Bedrock generation time.

**Sources of the ~42s and ~14s claims:**
- `themis-lex-active-checklist.md` line 12: "A single Bedrock call to Claude Sonnet 4.6 is taking ~42 seconds" — sourced from "Block 4 testing, validated through real use"
- `README.md` line 304: "My calls were hitting around 42 seconds at `max_tokens=6000` on Claude Sonnet 4.6"
- The ~14s Haiku figure does not appear in any file. It was observed during the live debugging session (the test call that returned HTTP 200 showed "Time: 14.3s" in terminal output) but was never logged to a file.

**The 42-second figure is documented but not measured by instrumentation.** It comes from CloudWatch REPORT lines showing `Duration: 28006ms` (Lambda killed at timeout) and the observation that calls consistently hit the timeout. The actual full generation time was inferred (never completed within the Lambda lifetime).

**The 14-second Haiku figure is recollection from a live test, not recorded in the repo.**

**Status:** UNVERIFIED for exact numbers. The 42s is documented in planning files as an observation from "Block 4 testing." The 14s is not documented anywhere in the repo. Neither has instrumented measurement backing.

---

## Corrections to My Draft

1. **max_tokens current value is 4000, not 3000.** The commit history shows it went 6000 → 3000 → 2000 → 4000 (bumped back up when Haiku was fast enough). If your article says the final value is 3000 or 6000, correct it to 4000.

2. **The streaming was attempted in TWO phases, not one.** Phase 1 (`7a6dd1d`): server-side collection only, no client changes. Phase 2 (`b744d34`): full end-to-end streaming with `res.write()` and client `getReader()`. Phase 2 was then reverted. If your article describes a single streaming attempt, it was actually two distinct approaches tried in sequence.

3. **The 14-second Haiku timing is not backed by any file in the repo.** If you cite it, attribute it to "observed during live testing" rather than "measured" or "logged." The 42-second Sonnet figure is at least documented in `themis-lex-active-checklist.md`, though also not instrumented.

4. **DEPLOY.md only documents `amplify.amazonaws.com` in the trust policy, not both principals.** The README has the correct dual-principal version. If you're referencing DEPLOY.md as your source, note the discrepancy — it appears DEPLOY.md was written before the `lambda.amazonaws.com` fix and was not updated.

5. **There are two commits with the same message "refactor: migrate Bedrock auth to IAM compute role" but different SHAs** (`792b94f` at 2026-05-09 20:31 and `e053255` at 2026-05-10 03:24 UTC). This appears to be a rebase or cherry-pick. If you cite the commit SHA, use `792b94f` which is the one visible on the `main` branch in linear history.

---

## Observations, Not Acted On

1. **The file header comment in `lib/bedrock.ts` says "max_tokens reduced to 3000"** but the actual constant is `4000`. Stale comment.

2. **The JSDoc comment above `callBedrock()` says "max_tokens set to 3000"** but the constant is `4000`. Same stale comment.

3. **`DEPLOY.md` line 27 only documents `amplify.amazonaws.com`** in the trust policy. The actual working trust policy requires both `amplify.amazonaws.com` and `lambda.amazonaws.com`. This doc is out of date.

4. **`lib/bedrock.ts` file header says "send a prompt to Claude Sonnet"** but the actual model is Haiku 4.5. Stale reference to Sonnet.

5. **The `README.md` at line 304 refers to `max_tokens=6000`** which was the original value. Current is `4000`.
