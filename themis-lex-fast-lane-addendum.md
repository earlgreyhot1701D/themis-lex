# Themis Lex — Fast Lane Addendum
**Version:** 1.0
**Status:** Authoritative for v1 build scope
**Companion to:** Kiro Brief v1.1, PRD v1.3, Prompt Spec v1.2, Architecture v1.1

---

## Why This Document Exists

The builder is operating against a hard credit constraint and a May 14 submission deadline. The standard Kiro Brief workflow ("propose before implement, gate every block, await approval before moving on") is the right discipline for a normal build. It is too slow for this one.

This addendum loosens the workflow rules in places where the cost of an unauthorized decision is low, and tightens them in places where the cost is high. Kiro follows this document for v1 scope. After v1 ships, the Kiro Brief workflow rules apply in full again.

If the Kiro Brief and this Addendum disagree about workflow during v1, this Addendum wins. For everything else (security rules, hooks, file/folder structure, prompt assembly, role keys), the original documents win.

---

## What Changed at the Product Level

Three decisions made on April 25, 2026 that this addendum reflects:

1. **Single Bedrock call at temperature 0.2.** Replaces the two-call differential temperature pattern from earlier drafts. Two-call is documented as a v2 enhancement and must not be built in v1.
2. **PDF download required at launch.** Not stubbed, not deferred. Block 5 stays in the build order as a MUST.
3. **Amplify stays.** Not switching to Vercel. The build target is unchanged.

---

## Batched Implementation Permission

For the following blocks, Kiro implements without per-step proposal gates. Kiro shows me a single diff or summary at the end of each block. If the diff conforms to the architecture and prompt spec, we move on. If something looks off, we roll back that block only.

**Batched (no per-step proposal):**
- **Block 1** — Extract job description PDFs into `role_context.json`. Structure is specified in Architecture Section 7 and Prompt Spec Section 2. No interpretation required.
- **Block 3** — `AssessmentForm.tsx` and client/server validation. UI design and validation rules are specified in the existing HTML mockup and Architecture Section 4.
- **Block 4** — `ResultsPanel.tsx`, `WorkflowCard.tsx`, `LoadingState.tsx`, `ErrorState.tsx`, `EmptyState.tsx`. Component contract is specified in Architecture Section 6.
- **Block 6** — UI polish and mobile responsiveness. Visual direction is locked.

**Still gated (proposal required before implementing):**
- **Block 2** — `/api/assess`, Bedrock client wrapper, prompt assembly logic. This is the AI layer. Wrong here is expensive.
- **Block 5** — `/api/pdf` and PDF generation. Choice of library (`@react-pdf/renderer` vs `pdfkit`) and rendering approach affects layout fidelity. Propose first.
- **Block 7** — AWS Amplify deployment. Environment variable handling and build settings need a sign-off before going live.
- **Any change to security-relevant code.** Always gated. The Kiro hooks are the floor; proposal review is the ceiling.

---

## What Batched Means

Within a batched block, Kiro:
- Implements the block end-to-end against the spec
- Runs locally to verify the block works
- Presents a single summary at the end: what was built, what files were created or modified, any deviations from the spec, and the QA question for that block
- Waits for me to give Pass/Fail before starting the next block

Kiro does **not** under any circumstance:
- Modify code outside the current block during a batched implementation
- Install new dependencies without flagging (Hook 6 still applies)
- Refactor existing code "while I'm in here" (Kiro Brief rule still applies)
- Skip the QA checkpoint at the end of a batched block

The hooks defined in the Kiro Brief (innerHTML block, eval block, credential exposure block, .env.local protection, undocumented file warn, new dependency warn) **stay enabled and unchanged** for every block, batched or gated.

---

## What "Pass" Looks Like for a Batched Block

For each batched block, Pass means:
- The QA question from PRD Section 9 / Architecture Section 10 is answered Pass
- No deviations from the spec
- No new dependencies installed without prior approval
- All security hooks were respected (no overrides)
- Block-specific acceptance criteria below are met

### Block 1 acceptance
- `role_context.json` exists at `/data/role_context.json`
- Three keys exactly: `ja1_2`, `ja3_courtroom`, `jss`
- Each key has `display_name` and `context` fields
- Content matches the chunks specified in Prompt Spec v1.2 Section 2

### Block 3 acceptance
- 120-character minimum enforces on both sides (try bypassing client to confirm server rejects)
- Disabled role options cannot be submitted (try bypassing client to confirm server rejects)
- All three sensitivity values accepted, all others rejected
- Form correctly transitions to loading state on submit

### Block 4 acceptance
- All five state components render without errors
- ResultsPanel correctly renders both columns from a mock JSON response
- Default empty state, loading state, error state, and results state all reachable
- No `innerHTML` anywhere (Hook 1 confirms)

### Block 6 acceptance
- Mobile breakpoint works at 375px width minimum
- Two-column results stack to single column on mobile
- Form remains usable on mobile
- Visual matches the existing HTML mockup at parity

---

## What Stays Strict

These rules are not relaxed under any condition. Speed does not buy out of any of these.

- **Security checklist.** Every item in Architecture Section 9 applies to every file. No exceptions.
- **Hooks.** All six remain enabled. Block-actions stay block-actions.
- **No statute citations in model output.** Prompt Spec Section 1 governs. Mock content in the existing HTML has been corrected to match this rule.
- **No `innerHTML` and no `eval()`.** Anywhere. Period.
- **API keys / AWS credentials live server-side only.** No `NEXT_PUBLIC_` prefix on anything sensitive.
- **Input validation client AND server.** Never one or the other.
- **Meaningful error states.** No blank screens. No raw stack traces shown to users.
- **One file, one responsibility.** No god files even under time pressure.

---

## Build Order — v1 Final

| Block | Mode | Block Type | What Kiro Builds |
|---|---|---|---|
| 1 | Batched | Data | `role_context.json` from extracted PDFs |
| 2 | Gated | AI layer | `/api/assess`, Bedrock wrapper, prompt assembly |
| 3 | Batched | Frontend | `AssessmentForm.tsx`, client + server validation |
| 4 | Batched | Frontend | All five state components, results rendering |
| 5 | Gated | Backend | `/api/pdf`, PDF generation, download wiring |
| 6 | Batched | Polish | UI polish, mobile responsiveness |
| 7 | Gated | Deploy | AWS Amplify deployment, env vars, smoke test |

---

## v2 Backlog (Built into Stub Comments Only)

These items are explicitly out of v1 scope and must remain stubs:

- **Two-call differential temperature** for the Bedrock layer
- **"How to Start" per `can_help` recommendation** (court-approved tool list dependency)
- **Six additional role classifications** (Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator, Self-Help Center Staff, Court Administrator)
- **Shareable link / unique URL per assessment** (database dependency)
- **Multi-court support** (separate role context per court)
- **Saved history / profile comparison**
- **Supervisor dashboard view**

Kiro adds the comment stubs in the file locations these would eventually live. Nothing more.

---

## What I Owe Kiro Before Block 1 Starts

1. The current Bedrock model ID string from the AWS console (verify before Block 2)
2. AWS Amplify app created and connected to the GitHub repo
3. `.env.local` populated with my credentials (and confirmed `.env.local` is in `.gitignore`)
4. The three job description PDFs available in `/data/source-pdfs/` so Block 1 has source material to extract from

---

## Submission Math

May 14 deadline. Today is April 25. That is 19 calendar days. Block 7 (deployment) needs at least 24 hours of buffer for DNS, Amplify build cycles, and final smoke testing. Realistic working window: 17 days for Blocks 1 through 6.

Average target: 2.5 days per block, with Blocks 2 and 5 (gated, AI and PDF) absorbing more time and Blocks 1, 3, 4, 6 (batched) absorbing less.

If I fall behind by Block 4, the v2 backlog gets longer. We do not push features down into v1 to "make up time." Cutting scope is the response to a slipping schedule. Adding scope under pressure is how court tools end up untrustworthy.

---

*Fast Lane Addendum v1.0 — Authoritative for v1 build scope through May 14, 2026 submission. After v1 ships, the standard Kiro Brief workflow rules apply in full.*
