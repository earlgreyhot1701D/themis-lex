# Themis Lex — Active Checklist (v1)
**Purpose:** Track items that need attention before v1 submission on May 14, 2026.
**Status:** Living document. Update as items complete or new ones surface.
**Companion docs:** `themis-lex-v2-roadmap.md` (post-launch features), `themis-lex-build-lessons.md` (process improvements)

---

## Critical — Address Before Submission (Trust-Affecting Issues)

These items affect whether court staff will trust and recommend the tool. Different from polish — polish is "make the good thing better." These items are "the tool feels broken without these fixes." Address before any deployment.

### Bedrock call latency — 42 seconds is too slow for user trust
**Source:** Block 4 testing, validated through real use
**Problem:** A single Bedrock call to Claude Sonnet 4.6 is taking ~42 seconds. Court staff testing a tool for the first time will assume it broke and refresh the page before results come back. The Block 6 loading-state polish (rotating messages, elapsed counter) makes the wait feel less broken but does not solve the underlying latency. People will not trust a tool that takes nearly a minute to return.

**Investigate before submission:**
- Run back-to-back calls and compare timings — if call 1 is 42s and call 2 is 15s, that's a Bedrock cold-start issue, not a code issue, and there are mitigations (warm-up calls on app load, server-side caching of the system prompt)
- Try dropping `max_tokens` from 6000 to 4500 and see if responses stay non-cramped — output token count is the dominant latency factor
- Check whether `us.anthropic.claude-sonnet-4-6` (cross-region inference profile) is routing through a slow region — try forcing `us-east-1` or `us-west-2` directly if available
- Try response streaming — `@aws-sdk/client-bedrock-runtime` supports `InvokeModelWithResponseStreamCommand`. Even if total time is the same, perceived latency drops significantly when text appears incrementally instead of waiting for the full response
- Consider whether the system prompt + role context + user message can be tightened — every input token is also a cost
- Last-resort option: split into two calls (the original v1 architecture) and stream both in parallel. Total time roughly halves if both calls run concurrently

**Acceptance:** Median assessment completes in under 25 seconds, OR the loading state is engaging enough that users don't perceive the wait as broken (rotating messages + elapsed counter + visual progress that genuinely correlates with progress, not arbitrary timed messages).

**Why this can't wait for v2:** The whole product premise is "court staff get trustworthy AI guidance fast enough to use it in their day." A tool that takes 42 seconds on a single call signals "this is a demo, not a real tool." That impression sticks. Better to address it as part of v1 than ship and hope users are patient.

---

## Block 6 (Polish) — Address During Polish Pass

### Loading state experience
**Source:** Block 4 testing (real Bedrock call took 42 seconds)
**Problem:** Current LoadingState component renders correctly but at 42-second latency, users will assume the app is broken without active feedback.
**Fix:**
- Rotating progress messages every 7-8 seconds. Copy lines, in order:
  - 0s: "Reading your workflow..."
  - 8s: "Applying judicial branch governance principles..."
  - 16s: "Calibrating to your role and sensitivity level..."
  - 24s: "Drafting your assessment..."
  - 32s: "Almost there. Court guidance is worth waiting for..."
  - Cycle last message if call exceeds 40 seconds
- Elapsed-time counter under the rotating message (format: "0:08, 0:09..."). Charcoal on cream, smaller than the message.
- `beforeunload` warning during loading state only. Standard browser "Changes you made may not be saved" prompt. Removed when results render.
- No spinning circle. No fake percentage bar. Animations must actually animate.

### "Reviewed" label on context chip
**Source:** Block 4 visual inspection
**Problem:** Date context chip says "Reviewed Apr 26, 2026" but no human reviewed it — the model generated it. "Reviewed" implies oversight that didn't happen.
**Fix:** Change label to "Generated" or "Assessed" or just remove the label and show the date alone.

### "Sensitivity" → "Data Sensitivity" label cleanup
**Source:** Block 4 visual inspection
**Problem:** The user-facing label "Sensitivity" is ambiguous on its own. The form section header already says "Data Sensitivity Required" so the abbreviated chip and loading copy are inconsistent and unclear.
**Fix:** Update three user-facing strings to say "Data Sensitivity" / "Data sensitivity":
1. Context chip label (currently "Sensitivity") → "Data Sensitivity"
2. Loading state step text (currently "Sensitivity match") → "Data sensitivity match"
3. PDF metadata row label (currently planned as "Sensitivity") → "Data Sensitivity"

Internal variable names (`sensitivity` in the JSON payload, validation, etc.) can stay as-is. This is a user-facing copy fix only.

### Trust copy on form intro
**Source:** Block 4 visual inspection
**Problem:** Form intro reads "The assessment runs on deterministic rules reviewed by court IT." Bedrock at temperature 0.2 isn't deterministic, and no court IT has reviewed this build. Both claims are inaccurate and could create credibility problems with real court users.
**Fix:** Replace with accurate copy. Suggested:
> "Uses AWS Bedrock and follows California judicial branch governance principles. No data you enter is stored or used to train any model."

### Helper text microcopy when submit is disabled
**Source:** Block 3 acceptance review
**Problem:** Block 3 confirmed helper text shows when submit button is disabled, but the actual copy wasn't reviewed.
**Fix:** Verify the message reads like guidance, not a system error. Should be specific and useful — e.g., "Add at least 120 characters to continue" — not "Validation failed" or generic.

### Disabled form-input visual state during loading
**Source:** Block 3 acceptance review
**Problem:** Confirmed inputs disable on submit, but disabled state must be visually distinct from active state. A disabled input that looks identical to active is a UX trap.
**Fix:** Verify disabled inputs have visible reduction in opacity, cursor change, or color shift. Make sure the difference is obvious without relying solely on cursor state.

### Plain-language guardrail polish
**Source:** Block 2 testing
**Problem:** Some `why_safe` guardrails could be more plain-language for a court audience (e.g., "strip identifiers" → "remove names and case numbers before pasting anything into the AI"). Partially addressed in Prompt Spec v1.2 polish, but worth re-reading any production output and flagging awkward phrases.
**Fix:** Read 5-10 production responses end to end. Note any phrasing that sounds developer-voice rather than court-supervisor voice. Patch system prompt if patterns emerge.

### PDF wordmark and subtitle spacing
**Source:** Block 5 visual review of generated PDF
**Problem:** The "THEMIS LEX" wordmark and "AI Readiness Self-Check" subtitle render directly on top of each other in the PDF header — no vertical space between them. Affects every PDF generated.
**Fix:** Add vertical spacing between the wordmark and subtitle in the PDF document component. Suggested approach: a `marginTop` or `paddingTop` of 6-8 pt on the subtitle Text element, or a `marginBottom` of equivalent value on the wordmark. Match the visual rhythm of the web header where similar separation exists. Located in `lib/pdf.ts`.

**Note:** This issue may be moot once the banner artwork replaces the text-based wordmark + subtitle (see "PDF brand banner replaces text header" below). If the banner ships, this item can be closed without separate code changes.

### Browser tab favicon
**Source:** Block 4 visual review — missing brand mark in browser tabs
**Problem:** The browser tab currently shows a generic globe icon with the page title. No Themis Lex brand mark anywhere in the tab. The favicon artwork has been generated (scales-of-justice with "TL" embedded in the negative space, terra accent corners on cream background).
**Fix:**
1. Place the favicon file at `public/favicon.png` (Next.js auto-detects favicons placed at the project root or `public/`, but explicit is safer).
2. Add a `<link>` tag inside the existing `<head>` in `app/layout.tsx`:
   ```jsx
   <link rel="icon" type="image/png" href="/favicon.png" />
   ```
3. Verify the icon renders cleanly in browser tabs at 16x16 and 32x32. The artwork's central "TL" should remain readable at small sizes — if it doesn't, the icon may need to be re-exported at thumbnail size or simplified.

### PDF brand banner replaces text header
**Source:** Block 5 visual review — brand asset now available
**Problem:** The current PDF header is text-based ("THEMIS LEX" wordmark + "AI Readiness Self-Check" subtitle). The branded horizontal banner artwork has been generated — full-width Themis figure with circuit-board border, wordmark, and "AI READINESS FOR CALIFORNIA COURT STAFF" tagline. Banner is roughly 3:1 aspect ratio, designed for full-width use.
**Fix:**
1. Place the banner image at `public/themis-lex-banner.png`.
2. In `lib/pdf.ts`, replace the current text-based wordmark + subtitle elements on page 1 with a single full-width `<Image>` component using the banner. Stretch to the printable page width, maintain aspect ratio.
3. Banner appears on **page 1 only** — subsequent pages keep their existing simple page header (no banner repeat — banner is too visually heavy for repeated use).
4. The metadata block (Generated / Role / Data Sensitivity) and the terra horizontal rule remain on page 1 below the banner, in the same order as today.
5. This change supersedes the wordmark/subtitle spacing fix above — if the banner ships, that item is closed.

**Note for Kiro:** `@react-pdf/renderer` imports for image rendering: `import { Image } from '@react-pdf/renderer';` Then `<Image src="/themis-lex-banner.png" />` with width style for full page width. PNG transparency works fine.

### Favicon footer mark on every PDF page
**Source:** Block 5 visual review — brand identity reinforcement
**Problem:** The PDF footer currently shows "Themis Lex · Page X of Y" as plain text. A small favicon-style mark in the footer reinforces brand identity on every page (especially helpful when supervisors print and pass around physical copies).
**Fix:**
1. Reuse the same `public/favicon.png` file used for the browser tab — favicon is small enough to render cleanly at footer scale, no separate asset needed.
2. In `lib/pdf.ts`, add a small `<Image>` element to the footer area on every page, sized at roughly 12-14 pt tall. Place left of or aligned with the existing page-number text.
3. Recommended footer layout: favicon mark (left), "Themis Lex" wordmark text (center, optional), "Page X of Y" (right). Keep the favicon subtle — it's a brand reminder, not a focal point.
4. Verify the favicon renders on every page including the disclaimer page at the end.

### Mobile breakpoints + responsive verification
**Source:** Fast Lane Addendum Block 6 acceptance criteria
**Fix:**
- Two-column results stack to single column at 768px and below
- Form remains full-width on mobile
- Character counter and submit button stay visible without scrolling on a 375px viewport
- Pill group stays horizontal but allows wrapping
- Header wordmark scales down proportionally
- Test on actual mobile device, not just resized browser window

### Beta release / "Spring 2026" copy in hero and footer
**Source:** Code review of `page.tsx`
**Problem:** Hero eyebrow says "A Self-Check Tool · Beta Release · Spring 2026" and footer says "v0.4 · Beta · Spring 2026". The "Beta Release" framing reinforces credibility (this is a v1 prototype, not a finished product), but the version number `0.4` is hardcoded in `page.tsx` and also in `package.json` and `.env.example`. If the version bumps post-submission, three files need to update.
**Fix:** Either centralize version in one place (e.g., read `NEXT_PUBLIC_APP_VERSION` from env into the footer) or accept the duplication and add a comment noting all three locations.

### Footer disclaimer in ResultsPanel duplicates condensed disclaimer
**Source:** Code review of `ResultsPanel.tsx`
**Observation:** The action bar contains a paragraph: *"This assessment is advisory. It does not replace supervisory review, court IT policy, or the Judicial Council's forthcoming AI guidance. Print a copy for your supervisor before implementing any recommendation."* This is good copy but partially overlaps with the disclaimer planned for the PDF (PRD Section 8). Worth ensuring the on-screen disclaimer and the PDF disclaimer are consistent in tone and message — they don't need to be identical but they should not contradict each other.
**Fix:** During Block 5 PDF build, cross-check the in-app disclaimer copy against the PDF disclaimer. Align tone if they drift.

---

## Pre-Submission Cleanup (Block 7 prerequisite)

These are items that Kiro flagged as needing removal before deployment.

- [ ] Remove `mock-assess.ts` temporary endpoint (Kiro confirmed during Block 4)
- [ ] Verify `.env.local` is not committed (Hook 4 should prevent this, but spot-check before push)
- [ ] Remove any `console.log` debug output added during development
- [ ] Verify `package.json` dependencies are pinned, not caret-ranged

---

## Implemented Mid-Build (Reference Only)

Features added after the original PRD scope but before v1 submission. Logged here so the checklist remains the canonical record of what's actually in v1.

### Description field on workflow cards
**Added:** Between bug round and Block 6
**What:** New `description` field on every can_help and must_not_touch item. One-sentence plain-language restatement of the workflow, rendered in italic serif above the labeled rows on both web and PDF cards.
**Why:** The original output buried the workflow explainer inside `why_safe` and `rule` paragraphs. New users without court context couldn't orient themselves before reading the substantive content. The description field gives every card a quick orienting sentence.
**Files touched:** `lib/validate.ts`, `lib/prompt.ts`, `components/WorkflowCard.tsx`, `app/globals.css`, `lib/pdf.ts`, `pages/api/mock-assess.ts`. Prompt Spec needs version bump to v1.3, Architecture to v1.2 (separate doc update).

### Start Over button
**Added:** After description-field patch, before Block 6 polish
**What:** "Start over" ghost button below the action bar in the results state and below the error message in the error state. Full reset — clears form, results, and error state. Returns page to default state. Uses a `formResetKey` prop on `AssessmentForm` to force React remount and clean form reset.
**Why:** No deliberate way to clear form and start fresh other than refreshing the page and losing context. Court staff running multiple assessments need a clean reset action.
**Files touched:** `app/page.tsx`, `components/ResultsPanel.tsx`, `components/ErrorState.tsx`, `app/globals.css`.

---

## How to Use This Document

When starting Block 6 polish, work through the polish section systematically. Hand to Kiro alongside a request for a proposal that groups items by file/component before implementation begins.

When starting Block 7, run the cleanup section before deploying. The mock-assess removal is the most important — it's a temporary endpoint that should not ship.

If new items surface during the build, add them here immediately rather than trusting memory. After v1 submission, items that move from "open" to "closed" can stay in the document with a strikethrough or move to a "completed in v1" section for the build narrative.
