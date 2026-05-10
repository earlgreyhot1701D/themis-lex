# Themis Lex — Deployment & Rollback

## Environment variables required

| Name | Where set | Notes |
| --- | --- | --- |
| `AWS_REGION` | Amplify Console | Bedrock region. Locked to `us-east-1` (matches the cross-region inference profile referenced by `BEDROCK_MODEL_ID`). |
| `AWS_ACCESS_KEY_ID` | Amplify Console | **Never commit.** IAM user with Bedrock invoke permission only. |
| `AWS_SECRET_ACCESS_KEY` | Amplify Console | **Never commit.** Pair of the access key above. |
| `BEDROCK_MODEL_ID` | Amplify Console | The Claude Sonnet 4.6 Bedrock model ID (cross-region inference profile, `us.` prefix). |
| `NEXT_PUBLIC_APP_VERSION` | Amplify Console | Surfaced in the UI footer. Bump on each deploy. |

The two AWS credentials MUST be configured through the Amplify Console under **App > Hosting > Environment variables**. They must never be added to `.env`, `.env.local`, or any committed file.

## Deploying

1. Push the release commit to `main`.
2. Amplify auto-detects the push and builds from `amplify.yml` at the project root.
3. When the build goes green, smoke-test the live URL (checklist at the bottom of this doc).

## Rollback

The primary rollback method is the Amplify Console's **Redeploy this version** button on a prior successful build.

Click path: **App > Hosting > Build history > pick prior successful build > Redeploy this version**.

This restores the previous artifact bundle without touching `main`. DNS and custom-domain configuration do not need to change — the same Amplify hostname keeps serving traffic, just from the older build.

## Logging

`console.error` calls in the API routes (`pages/api/assess.ts`, `pages/api/pdf.ts`) flow to CloudWatch automatically via Amplify's Lambda runtime. No additional setup is needed for MVP.

STUB V2: structured logging with request IDs — emit JSON lines carrying `requestId`, `route`, `latencyMs`, and a redacted error fingerprint. A small `lib/log.ts` helper wrapping `console.error` / `console.log` is the natural shape. Source the request ID from `x-amzn-trace-id` when present, fall back to a generated UUID.

## Monitoring

STUB V2: CloudWatch alarms are not wired for MVP. Acceptable risk for a 5-day timeline with low expected traffic.

Post-MVP, add alarms for:
- Bedrock 4xx/5xx rate from `/api/assess` exceeding a threshold over a 5-minute window.
- PDF generation failures from `/api/pdf` exceeding a threshold.
- Sustained 429 spike on either endpoint — indicates a need to tune `lib/rateLimit.ts` or move it to a shared backend per its STUB V2 note.

## Smoke test checklist

- [ ] Homepage loads on the live URL.
- [ ] Form accepts a 120-character workflow description and submits without error.
- [ ] Assessment results render (both `can_help` and `must_not_touch` rows visible).
- [ ] PDF downloads via the download button.
- [ ] Fonts and banner appear correctly in the rendered PDF.
