# Themis Lex — Product Requirements Document
**Version:** 1.3
**Status:** Locked — Ready for build
**Challenge:** Women in AI Accelerator — Build Challenge
**Submission Deadline:** May 14, 2026
**Builder:** [Your Name] — Judicial Services Manager, Santa Barbara Superior Court

---

## 1. Problem Statement

California courts are being asked to adapt to AI without structured guidance on where it is safe and where it is not. Court staff handle some of the most protected data in the state system — personally identifiable information for case parties, witnesses, victims, and jurors; active case files; sealed records; and personnel information governed by California civil service law.

Generic AI advice is everywhere. Role-specific, court-aware, governance-grounded guidance does not exist.

This is not a hypothetical problem. It is a problem the builder experiences professionally.

---

## 2. Solution

Themis Lex is an AI readiness self-check tool built specifically for California court staff. A court employee enters their role, describes their workflow, and selects their data sensitivity level. The tool returns two outputs of equal weight: where AI can help them, and where AI must never touch their work — grounded in California judicial branch governance principles.

The output downloads as a PDF the user can hand to their supervisor.

**What makes the output role-specific, not generic:**

Most AI guidance tools guess at what a user's job involves. Themis Lex does not guess. The tool is grounded in the actual public job descriptions for each supported classification, downloaded directly from the Santa Barbara Superior Court's recruitment portal. These documents describe the real duties, data types, and responsibilities of each role in the court's own language. They are extracted, cleaned, and injected silently into every API call as role context -- so when a Judicial Assistant III Courtroom describes their workflow, the model already knows they take official minutes, administer oaths, and maintain custody of evidence. That specificity is what separates a useful output from a generic one.

**Tagline:** Court-admissible AI guidance. Built for the people who run the courts.

---

## 3. Target Users

**Phase 1 (this build) — 3 classifications:**
- Judicial Assistant I/II (one class, two levels — treated as one role context)
- Judicial Assistant III Courtroom (distinct classification)
- Judicial Services Supervisor / Sr. (same class, two levels — treated as one role context)

These three classifications cover the core court operations staff at California Superior Courts. All job descriptions are publicly available and will be used as role-specific context via `role_context.json`.

**STUB — Phase 2 (role context pending, visually disabled in UI):**
- Courtroom Clerk
- Deputy Clerk
- Research Attorney
- Family Law Facilitator
- Self-Help Center Staff
- Court Administrator

These are adjacent roles and subcategories that may be built out in a later phase. They appear in the role selector as disabled options with the label: "Role context for this classification is pending."

**Out of scope — all phases:**
- Judges, commissioners, and elected officials
- IT staff, facilities, and security
- Multi-court deployments (STUB, V2)

---

## 4. Judging Criteria Alignment

| Criteria | Weight | How Themis Lex Addresses It |
|---|---|---|
| Community vote | 40% | Strong UI, shareable concept, real institutional problem |
| Build quality | 40% | Works, is useful, solves a real problem the builder lives |
| Consistency posts | 20% | Week 1: PartyRock prototype. Weeks 2-3: build updates |

**Category targets:**
- Best Work AI Use Case (primary)
- Best AI for Good (secondary)

---

## 5. Weekly Milestone Plan

| Date | Deliverable |
|---|---|
| Apr 25 | Post 1: Problem framing + PartyRock prototype demo |
| May 2 | Post 2: Build update — working MVP with role context |
| May 9 | Post 3: Final stretch — PDF download live, UI polished |
| May 14 | Final submission + vote campaign post |

---

## 6. Feature Scope

### MUST — Phase 1

**Input Layer**
- Role selector dropdown:
  - **Active:** Judicial Assistant I/II, Judicial Assistant III Courtroom, Judicial Services Supervisor / Sr.
  - **Disabled (STUB):** Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator, Self-Help Center Staff, Court Administrator — each displays as disabled with tooltip/label: "Role context for this classification is pending."
- Workflow description text field: 120 character minimum, strong placeholder copy, enforced client-side and server-side
- Data sensitivity selector: Low (public filings, scheduling) / Medium (internal, non-sealed) / High (sealed · minors · PII)

**Prompt Assembly Layer (invisible to user)**
- `court_context` variable: California judicial branch AI governance principles, not specific statute citations. Injected silently into every prompt.
- `role_context` variable: Extracted text from the relevant public job description PDF, chunked and keyed by role, injected at query time based on role selection.
- Both variables fire on every API call. User never sees them.

**Output Layer**
- **Where AI Can Help You** — 3 to 5 role-specific opportunities. Format per item: Workflow name / Why it's safe / Guardrails.
- **Where AI Must Not Touch** — 3 to 5 role-specific restrictions. Format per item: Workflow name / Rule / Risk / Instead.
- **Single API call** at temperature `0.2`. Returns both arrays in one structured response. Lower temperature favors consistency, which matters more for restrictions than creativity matters for opportunities. See Prompt Spec Section 4 for tradeoff documentation.

**PDF Download (MUST work at launch)**
- Triggered by user after outputs render
- PDF includes: timestamp, role selected, sensitivity level selected, both outputs formatted as a readable document, Themis Lex header, disclaimer (see Section 8)
- Generated server-side via `/api/pdf` route. No client-side canvas. No `jsPDF`. No browser-print fallback.
- The PDF is the artifact a court employee hands to their supervisor. It is the product, not a nice-to-have.
- No login required. No server-side storage of user data after the file is streamed.

**UI**
- Single-page application
- Mobile-responsive
- High design quality — light base (#F5F0E8 cream), strong typography hierarchy, terra (#C4622D) as primary accent
- Outputs render as structured two-column documents, not chat bubbles. Left column (sage green tint) = where AI can help. Right column (terra tint) = where AI must not touch.
- Loading state during API call — not a blank screen

**Error Handling**
- try/catch on every fetch
- Meaningful error states with user-facing copy — never a blank screen
- Input validation client-side AND server-side

### STUB — V2 (do not build, add comment notes only)

- **"How to Start" per recommendation** — a safe, generic first step per "Where AI Can Help You" item. No tool names, no specific legal guidance, links to Judicial Council AI resources. Do not build until court-approved tool list is confirmed.
- Shareable link / unique URL per readiness profile
- Multi-court deployment (other California Superior Courts)
- Additional role classifications (Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator, Self-Help Center Staff, Court Administrator)
- Supervisor dashboard view
- Saved history / profile comparison

### NEVER — This Build

- Specific statute citations generated by the model (hallucination risk in a court context)
- User accounts or authentication
- Unsupervised handling of real case data
- innerHTML usage anywhere in the codebase
- eval() anywhere in the codebase
- API keys exposed client-side
- Half-built features without stub comments

---

## 7. Technical Architecture

```
PDFs (public job descriptions, 3 classifications)
  ↓ extract once via pdfplumber
role_context.json (keyed by role)
  ↓
User inputs: role + workflow description + sensitivity level
  ↓
Prompt assembly: court_context + role_context[role] + user inputs
  ↓
Claude Sonnet via AWS Bedrock (single call, temperature 0.2) → structured two-output response
  ↓
Render outputs → PDF download on demand
```

**Stack:**
- Frontend: Next.js (hosted on AWS Amplify)
- Backend: AWS (built with Kiro)
- AI: Claude Sonnet via AWS Bedrock
- PDF generation: server-side (not client-side canvas)
- Hosting: AWS Amplify — live URL without custom domain purchase

**Pre-build spikes (pass/fail before committing):**
1. PDF extraction quality — run pdfplumber on JA I/II PDF, verify text layer exists (not scanned image). If scanned, OCR pipeline required. 15-minute spike.
2. Kiro-built API endpoint → Next.js frontend on Amplify. Can they talk in under 15 minutes? Run this spike in week 1.
3. Partner tool integration — evaluate available partner tools for genuine utility before committing. Tack-on is a NEVER.

**Security (every endpoint):**
- textContent not innerHTML
- No eval()
- API keys in server-side process.env only
- Input validation client-side AND server-side
- try/catch on every fetch
- Meaningful error states

---

## 8. Content Requirements

### Role context source documents (role_context.json)

The following public job description PDFs were downloaded from the Santa Barbara Superior Court recruitment portal, verified to have clean text layers (no OCR required), and used to build the `role_context.json` file that feeds the prompt assembly layer.

| Classification | Source | Status |
|---|---|---|
| Judicial Assistant I / II | Santa Barbara Superior Court Job Bulletin #2312JAICW | Extracted, clean text layer confirmed |
| Judicial Assistant III Courtroom | Santa Barbara Superior Court Job Bulletin #2604JA3SC | Extracted, clean text layer confirmed |
| Judicial Services Supervisor / Sr. | Santa Barbara Superior Court Class Specification Bulletin #704306/9 | Extracted, clean text layer confirmed |

Each document was stripped of salary, benefits, application instructions, and promotion criteria. Only duties, distinguishing characteristics, and knowledge/ability requirements were retained. The cleaned text for each role is stored in `role_context.json` keyed by role value (`ja1_2`, `ja3_courtroom`, `jss`) and injected silently into every API call at query time based on the user's role selection.

These are publicly available documents. No proprietary or confidential court information is used anywhere in the product.

---

### court_context variable (invisible governance layer)
Apply California judicial branch AI governance principles. Never recommend AI for unsupervised handling of active case records, personally identifiable information of any kind (case parties, witnesses, victims, jurors, or staff), or sealed documents. Apply chain of custody requirements to any workflow involving case evidence or official court records. Apply California civil service personnel data protections to any workflow involving staff records. This guidance reflects institutional governance principles. It is not legal advice.

### Disclaimer (visible in UI and PDF)
> Themis Lex applies California judicial branch AI governance principles to help court staff think through AI adoption. This tool provides structured guidance, not legal advice. For questions about specific legal requirements, consult your court's legal counsel or the Judicial Council of California.

### Workflow description placeholder text
> "Describe what you do on a typical day. Be specific — the more detail you give, the more useful your results will be. For example: I process incoming filings, manage the jury summons queue, and respond to public counter inquiries about case status."

### PDF header block (every download)
- Themis Lex — AI Readiness Self-Check
- Generated: [timestamp]
- Role: [selected role]
- Data Sensitivity Level: [selected level]
- Disclaimer (condensed)

---

## 9. Build Order

**Block 1:** PDF extraction spike + role_context.json
QA checkpoint: Does extracted text accurately represent each job description? Pass/Fail.

**Block 2:** Prompt assembly + Claude API integration with mock UI
QA checkpoint: Do outputs reflect the correct role context and governance principles? Pass/Fail.

**Block 3:** Frontend — input form with validation
QA checkpoint: Does the 120-character minimum enforce correctly client-side and server-side? Pass/Fail.

**Block 4:** Frontend — output rendering
QA checkpoint: Do outputs render as structured documents, not raw text? Are loading and error states working? Pass/Fail.

**Block 5:** PDF download
QA checkpoint: Does the PDF include all required header fields? Is the formatting readable? Pass/Fail.

**Block 6:** UI polish + mobile responsiveness
QA checkpoint: Does it look like something you'd pay for? Pass/Fail.

**Block 7:** AWS Amplify deployment
QA checkpoint: Is the live URL accessible? Do all API calls work in production? Pass/Fail.

---

## 10. Open Questions (resolved before build starts)

- [x] Partner tool evaluation — Composio reviewed and passed on. No partner tool in the v1 build. Tack-on is a NEVER per Section 7.
- [x] UI direction — light base (#F5F0E8 cream), terra accent (#C4622D). Decided. Design locked.
- [x] PDF extraction spike — all 3 PDFs have clean text layers. No OCR required. PASS.
- [x] All 3 job description PDFs downloaded and reviewed. role_context.json ready to build.
- [x] Claude model confirmed as **Sonnet 4.6** via AWS Bedrock. Sonnet 4.6 launched on Bedrock February 17, 2026 and is a direct upgrade from Sonnet 4.5 with improved instruction-following at lower cost. Model string: `us.anthropic.claude-sonnet-4-6`. The `us.` prefix indicates a US cross-region inference profile, which Bedrock requires for on-demand invocation of Sonnet 4.6 (the bare `anthropic.claude-sonnet-4-6` foundation model ID does not support on-demand throughput). Verified working via `aws bedrock-runtime invoke-model` test call.
- [x] Single Bedrock call vs. two-call differential temperature. Resolved: single call at 0.2 to keep build scope realistic for credit budget. Two-call differential temperature documented as v2 enhancement. See Fast Lane Addendum.

---

## 11. Out of Scope — Explicit

- Specific California statute citations generated by the model
- RAG on California legal code
- User accounts or login
- Shareable links (STUB, V2)
- Multi-court support (STUB, V2)
- Agents or multi-hop orchestration
- Any feature not explicitly listed as MUST above

---

*PRD v1.3 — All open questions resolved. Single Bedrock call at 0.2. PDF download required at launch. Design locked. PDF spike complete. See Fast Lane Addendum for build scope and Kiro permissions.*