# Themis Lex — Architecture Document
**Version:** 1.1
**Status:** Ready for Kiro implementation
**Depends on:** PRD v1.3, Prompt Spec v1.2
**Stack:** Next.js · AWS Amplify · AWS Bedrock · Claude Sonnet

---

## 1. Overview

Themis Lex is a single-page Next.js application hosted on AWS Amplify. The frontend collects three user inputs, sends them to a server-side API route, which assembles the prompt and makes one call to Claude Sonnet via AWS Bedrock at temperature 0.2. The response is rendered as two structured output columns. The user can download the assessment as a server-generated PDF. No user data is stored at any point.

```
User browser (Next.js frontend)
  ↓ POST /api/assess
Next.js API route (server-side)
  ↓ Prompt assembly: court_context + role_context[role] + user inputs
AWS Bedrock (Claude Sonnet)
  ↓ Structured JSON response
Next.js API route
  ↓ Validated, returned to client
User browser → renders output columns
  ↓ User triggers PDF download
Next.js API route (/api/pdf)
  ↓ Generates PDF server-side
User browser → downloads PDF
```

---

## 2. File and Folder Structure

```
themis-lex/
├── app/
│   ├── page.tsx                  # Single page application — form + results
│   ├── layout.tsx                # Root layout, metadata, fonts
│   └── globals.css               # Design tokens, global styles
├── components/
│   ├── AssessmentForm.tsx        # Role selector, workflow textarea, sensitivity pills
│   ├── ResultsPanel.tsx          # Two-column output renderer
│   ├── WorkflowCard.tsx          # Individual card component (help + notouch variants)
│   ├── LoadingState.tsx          # Loading indicator during API call
│   ├── ErrorState.tsx            # Error state — never a blank screen
│   └── EmptyState.tsx            # Default state before assessment runs
├── pages/
│   └── api/
│       ├── assess.ts             # POST — prompt assembly + Bedrock call
│       └── pdf.ts                # POST — server-side PDF generation
├── lib/
│   ├── prompt.ts                 # Prompt assembly logic
│   ├── bedrock.ts                # AWS Bedrock client wrapper
│   ├── validate.ts               # Input validation (server-side)
│   └── pdf.ts                    # PDF generation logic
├── data/
│   └── role_context.json         # Extracted job description chunks, keyed by role
├── public/
│   └── fonts/                    # Self-hosted fonts if needed
├── .env.local                    # Local environment variables (never committed)
├── .env.example                  # Environment variable template (committed, no values)
├── next.config.js                # Next.js config
├── package.json
└── README.md
```

**One file, one responsibility. No god files.**

---

## 3. Environment Variables

Store in `.env.local` locally. In AWS Amplify, set via Amplify Console environment variables — never in code.

```bash
# .env.example — commit this, not .env.local

# AWS Bedrock
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6

# App
NEXT_PUBLIC_APP_VERSION=0.4
```

**NEVER:**
- Commit `.env.local`
- Expose any key to the client (`NEXT_PUBLIC_` prefix only for non-sensitive values)
- Hardcode credentials anywhere in the codebase

---

## 4. API Routes

### POST `/api/assess`

**Responsibility:** Validate inputs, assemble prompt, call Bedrock, return structured JSON.

**Request body:**
```json
{
  "role": "ja1_2" | "ja3_courtroom" | "jss",
  "workflow": "string, min 120 chars",
  "sensitivity": "low" | "medium" | "high"
}
```

**Response (success):**
```json
{
  "can_help": [
    {
      "workflow_name": "string",
      "why_safe": "string",
      "guardrails": "string"
    }
  ],
  "must_not_touch": [
    {
      "workflow_name": "string",
      "rule": "string",
      "risk": "string",
      "instead": "string"
    }
  ]
}
```

**Response (error):**
```json
{
  "error": true,
  "message": "string — user-facing copy, never a raw error message"
}
```

**Validation (server-side, non-negotiable):**
- `role` must be one of the three active values. Reject disabled/stub roles.
- `workflow` must be a string, minimum 120 characters after trim.
- `sensitivity` must be one of three valid values.
- All fields required. Return 400 with user-facing message if any fail.

**Security:**
- try/catch on every Bedrock call
- Parse JSON response safely inside try/catch
- Validate response structure before returning to client
- No user input stored server-side

---

### POST `/api/pdf`

**Responsibility:** Accept assessment results, generate PDF, return as downloadable file.

**Request body:**
```json
{
  "role_label": "string — display name",
  "sensitivity_label": "string — Low | Medium | High",
  "timestamp": "string — ISO format",
  "can_help": [...],
  "must_not_touch": [...]
}
```

**Response:** PDF file stream, `Content-Type: application/pdf`

**PDF content (required per PRD):**
- Themis Lex header
- Generated timestamp
- Role selected
- Sensitivity level selected
- Both output columns formatted as readable document
- Disclaimer (condensed)

**Library:** Use `@react-pdf/renderer` or `pdfkit` server-side. No client-side canvas. No `jsPDF`. No browser-print fallback.

**Required at launch.** The PDF is the artifact a court employee hands to a supervisor. Per PRD v1.3 Section 6, this feature is MUST. Build in Block 5 per the build order. Do not stub. Do not defer.

---

## 5. Data Flow — Step by Step

**Step 1 — User fills form**
- Role selector (3 active options, 6 disabled with label)
- Workflow textarea (120 char minimum, counter visible)
- Sensitivity pill selector (Low / Medium / High)
- Submit button disabled until 120 char minimum met

**Step 2 — Client-side validation**
- Character count enforced before submit
- Disabled role options blocked from submission
- Sensitivity must be selected

**Step 3 — POST to /api/assess**
- Form data sent as JSON
- UI transitions to loading state immediately
- Form inputs disabled during request

**Step 4 — Server-side validation**
- Re-validate all inputs (never trust the frontend)
- Reject and return 400 if any fail

**Step 5 — Prompt assembly**
- Load `role_context.json`
- Retrieve chunk for selected role
- Assemble: system prompt (court_context) + role chunk + user inputs
- See Prompt Spec v1.2 for exact template

**Step 6 — Single Bedrock call**
- One API call to Claude Sonnet via Bedrock at temperature `0.2`
- Request both `can_help` and `must_not_touch` arrays in one structured response
- See Prompt Spec v1.2 Sections 1, 3, and 4 for the full prompt and rationale
- Two-call differential temperature is documented as a v2 enhancement and must not be built in v1

**Step 7 — Response validation**
- Parse JSON safely inside try/catch
- Validate both arrays exist and are non-empty
- Validate each item has required fields
- If validation fails, return error state to client

**Step 8 — Render results**
- Client receives merged JSON
- ResultsPanel renders two columns
- WorkflowCard renders each item
- Context chips show role, sensitivity, date
- Action bar with PDF download button appears

**Step 9 — PDF download (user-triggered)**
- User clicks Download PDF Report
- Client POSTs results to /api/pdf
- Server generates PDF, streams to client
- Browser downloads file

---

## 6. Component Responsibilities

| Component | Responsibility | State it owns |
|---|---|---|
| `page.tsx` | Orchestrates all state, passes props down | `appState`, `results`, `formData` |
| `AssessmentForm.tsx` | Collects inputs, fires submit | `charCount`, local form values |
| `ResultsPanel.tsx` | Renders two-column layout | None — receives results as props |
| `WorkflowCard.tsx` | Renders one card (help or notouch variant) | None — pure display |
| `LoadingState.tsx` | Loading indicator | None |
| `ErrorState.tsx` | Error display with user-facing copy | None |
| `EmptyState.tsx` | Default before assessment | None |

**App state machine (in page.tsx):**
```
'default' → form visible, empty state shown
'loading' → form disabled, loading state shown, both output columns hidden
'results' → form visible, results shown, PDF button visible
'error'   → form visible, error state shown, results hidden
```

---

## 7. role_context.json Structure

Built in Block 1 from the three extracted PDFs. Stored in `/data/role_context.json`.

```json
{
  "ja1_2": {
    "display_name": "Judicial Assistant I / II",
    "context": "ROLE: Judicial Assistant I / II..."
  },
  "ja3_courtroom": {
    "display_name": "Judicial Assistant III — Courtroom Assignment",
    "context": "ROLE: Judicial Assistant III — Courtroom Assignment..."
  },
  "jss": {
    "display_name": "Judicial Services Supervisor / Sr.",
    "context": "ROLE: Judicial Services Supervisor / Judicial Services Supervisor Sr...."
  }
}
```

Full context strings are in Prompt Spec v1.2, Section 2.

---

## 8. AWS Amplify Deployment

**Build settings (amplify.yml):**
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Environment variables:**
Set in Amplify Console under App Settings > Environment Variables. Never in code.

**Live URL format:** `https://main.[app-id].amplifyapp.com`
No custom domain purchase required.

**Deployment checklist before going live:**
- [ ] All environment variables set in Amplify Console
- [ ] API routes tested end-to-end in production environment
- [ ] Error states verified — no blank screens
- [ ] PDF download tested in production
- [ ] Mobile layout verified on actual device
- [ ] Character counter works in production
- [ ] Disabled role options confirmed non-submittable

---

## 9. Security Checklist

Applied to every file, every endpoint, every commit.

- [ ] `textContent` not `innerHTML` for all dynamic content rendering
- [ ] No `eval()` anywhere in the codebase
- [ ] API keys in server-side `process.env` only — never `NEXT_PUBLIC_`
- [ ] Input validation client-side AND server-side — both required, not either/or
- [ ] try/catch on every fetch, every Bedrock call, every JSON parse
- [ ] Meaningful error states — never a blank screen, never a raw error message to the user
- [ ] `.env.local` in `.gitignore` — verify before first commit
- [ ] No user data stored server-side after response is returned
- [ ] Response JSON validated for structure before rendering
- [ ] Disabled role options rejected server-side even if client-side is bypassed

---

## 10. Build Order (mirrors PRD Section 9)

| Block | What Kiro builds | QA Checkpoint |
|---|---|---|
| 1 | `role_context.json` from extracted PDFs | Extracted text accurately represents each job description. Pass/Fail. |
| 2 | `/api/assess` + Bedrock integration + mock UI | Outputs reflect correct role context and governance principles. Pass/Fail. |
| 3 | `AssessmentForm.tsx` + client/server validation | 120-char minimum enforces correctly on both sides. Pass/Fail. |
| 4 | `ResultsPanel.tsx` + `WorkflowCard.tsx` + all states | Outputs render as structured cards. Loading and error states work. Pass/Fail. |
| 5 | `/api/pdf` + PDF download | PDF includes all required header fields. Formatting is readable. Pass/Fail. |
| 6 | UI polish + mobile responsiveness | Looks like something you'd pay for. Pass/Fail. |
| 7 | AWS Amplify deployment | Live URL accessible. All API calls work in production. Pass/Fail. |

**Rule: Do not start the next block until the current block passes QA.**

---

## 11. STUB Notes for Kiro

Add these comments in the codebase exactly where the stub belongs. Do not build the feature. Do not build half the feature.

```typescript
// STUB V2: Shareable link / unique URL per assessment
// Implementation notes: requires database (DynamoDB), unique ID generation,
// URL scheme /assessment/[id], read-only public view
// Do not build until user data storage policy is defined

// STUB V2: "How to Start" per can_help recommendation
// Implementation notes: generic first step per workflow type, no tool names,
// links to Judicial Council AI resources
// Do not build until court-approved tool list is confirmed

// STUB V2: Additional role classifications
// Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator,
// Self-Help Center Staff, Court Administrator
// Do not build until job description PDFs are extracted and role_context.json updated
```

---

*Architecture v1.1 — Built against PRD v1.3 and Prompt Spec v1.2. Single Bedrock call at 0.2. PDF download required at launch. Do not begin build until Kiro has reviewed PRD v1.3, Prompt Spec v1.2, this Architecture v1.1, the Kiro Brief, and the Fast Lane Addendum. Any deviation from this architecture requires PRD review first.*