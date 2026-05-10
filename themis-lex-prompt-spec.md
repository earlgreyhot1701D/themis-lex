# Themis Lex — Prompt Specification
**Version:** 1.2
**Status:** Ready for Kiro implementation
**Depends on:** PRD v1.3, role_context.json (Block 1 output)

---

## Overview

Every API call to Claude assembles three layers in order:

1. `court_context` — silent governance layer, never changes
2. `role_context[role]` — job-specific context, keyed by role selection
3. User inputs — role, workflow description, sensitivity level

The model returns a single structured JSON response containing both output columns. **One API call per assessment.** No multi-hop. No agents. One call, one response.

---

## 1. System Prompt

This is the system prompt sent on every request. It does not change based on user input.

```
You are Themis Lex, an AI readiness assessment tool built specifically for California Superior Court staff.

GOVERNANCE LAYER — apply to every response:
Apply California judicial branch AI governance principles throughout your assessment. Never recommend AI for unsupervised handling of active case records, personally identifiable information of any kind (case parties, witnesses, victims, jurors, or staff), or sealed documents. Apply chain of custody requirements to any workflow involving case evidence or official court records. Apply California civil service personnel data protections to any workflow involving staff records. This guidance reflects institutional governance principles. It is not legal advice.

OUTPUT RULES:
- Never cite specific California statutes or code sections. Speak in governance principles only.
- Never recommend a specific AI tool or vendor by name.
- Never generate legal advice. You provide structured guidance, not legal counsel.
- All restrictions must include a human alternative — never leave a restriction without a "Instead" path.
- Responses must be grounded in the role context provided. Do not generalize beyond what the role description supports.
- Write guardrails in plain language for a court employee, not a developer. When you mean "remove names and case numbers before pasting anything into the AI," say that — not "strip identifiers" or "redact PII." Court staff are careful and rule-following, not technical. The guardrail should read like advice from a thoughtful supervisor.
- For any can_help item involving procedural or legal research (court rules, filing requirements, procedural frameworks), the guardrails MUST include a verification step against an authoritative human source. Plain examples: "Confirm any procedural detail with your supervisor or the current local rules before relying on it." or "Verify against the official Judicial Council form before sharing with a litigant." AI-assisted research without a verification step risks hallucinated citations or outdated guidance reaching court users.

RESPONSE FORMAT:
Respond only in valid JSON. No preamble. No explanation outside the JSON structure. No markdown code fences.

IMPORTANT — JSON IS TRANSPORT, NOT DISPLAY:
The user never sees raw JSON. The frontend maps each JSON field to a labeled card row in the UI, rendering entirely as natural language. All values inside the JSON fields must be written in plain, clear English appropriate for a court employee to read. Write as if speaking directly to the person, not to a developer.
```

---

## 2. Role Context Chunks

These are extracted from the public job description PDFs and injected at query time based on role selection. Strip all salary, benefits, application instructions, and promotion criteria before storing. Keep only duties, distinguishing characteristics, and knowledge/ability requirements.

Store in `role_context.json` keyed exactly as shown below.

### Key: `ja1_2`

```
ROLE: Judicial Assistant I / II — Santa Barbara Superior Court
LEVEL: Entry to journey level. Front-line court operations.
UNITS: May be assigned to Civil, Criminal, Jury, Juvenile, Records, or Traffic.

PRIMARY DUTIES:
- Greets public and answers phones; provides information to staff, attorneys, and public regarding cases, rules, and court procedures
- Receives and examines legal documents for accuracy, completeness, and conformity; processes filing and adjudication documents
- Accepts payment of fees, bail, and fines; operates and balances cash register
- Prepares and maintains documents, exhibits, and case files; enters information from legal documents into case management system
- Conducts research pertaining to document filing requirements
- Prepares and issues legal orders including warrants, writs, orders, subpoenas, abstracts of judgment
- Prepares court calendars; calendars cases for hearing
- Impanels, assembles, orients, and excuses jurors; maintains juror attendance records and compensation
- Provides specialized clerical support to court programs; screening and intake of program participants

REQUIRED ABILITIES:
- Maintain confidentiality
- Utilize sound judgment in performing court-related duties
- Understand, explain, and comply with a variety of detailed procedures
- Communicate effectively with staff, legal community, and public

DATA EXPOSURE: Active case files, legal documents, juror PII, fee and bail records, sealed case information across multiple division types.
```

### Key: `ja3_courtroom`

```
ROLE: Judicial Assistant III — Courtroom Assignment — Santa Barbara Superior Court
LEVEL: Journey and advanced journey level. Primary focus is in-courtroom support.
DISTINGUISHING: Assigned formal and primary responsibility for in-courtroom judicial support work. May lead and train less experienced courtroom clerks.

PRIMARY DUTIES:
- Attends court sessions and takes official minutes of actions and proceedings
- Requests clarifications of instructions and order of actions to properly note the official court record
- Examines ledgers, reports, and financial documentation for technical defects and accuracy
- Maintains court records and files including records of court-appointed counsel and experts
- Receipts, marks, and takes custody of evidence
- Impanels and polls jurors; records challenges; administers oaths and affirmations to witnesses and jurors
- Records jury service and compensation due jurors
- Advises attorneys, public agencies, and public on status of cases and procedural information
- Prepares and reviews court documents for format and content
- Prepares court calendars; confers with appropriate individuals per established procedures

REQUIRED ABILITIES:
- Maintain confidentiality
- Utilize sound judgment in performing court-related duties
- Lead, train, assign, and review work of others
- Knowledge of laws, policies, and procedures associated with all types of trials and court proceedings

DATA EXPOSURE: Official court record, active proceedings, evidence in custody, juror records, witness information, court-appointed counsel records. Highest sensitivity of all three classifications.
```

### Key: `jss`

```
ROLE: Judicial Services Supervisor / Judicial Services Supervisor Sr. — Santa Barbara Superior Court
LEVEL: Supervisory. Plans and administers activities within a court division. First-level supervisor over a unit comprised primarily of Judicial Assistants.
DISTINGUISHING: Sr. level has wider range and more complex non-judicial functions, higher degree of independence and public visibility, greater interaction with judicial officers.

PRIMARY DUTIES:
- Supervises and coordinates work performed by staff serving in the courtroom; inventories court exhibits; monitors jury instructions and bail bond forfeiture
- Plans, organizes, and supervises examination, acceptance, and processing of non-judicial and court documents
- Monitors and determines time requirements for specific calendar documents needing judicial approval
- Reviews background information for issuing of summonses, warrants, and abstracts of judgment
- Ensures files are properly set up and maintained; devises tracking systems to monitor file location
- Monitors and reviews selected documents for accuracy; compiles statistical information and reports
- Oversees calendaring of cases, judicial assignments, and flow of case information within the court
- Reviews new laws and develops or modifies unit procedures accordingly
- Assists in revision and development of division policies
- Provides information regarding court practices and procedures to attorneys, legal secretaries, County departments, and public
- Selects, trains, and evaluates employees; develops and conducts training programs
- Plans and implements modifications in computer software; maintains liaison with other court divisions
- Does special projects as requested by court administration

REQUIRED ABILITIES:
- Supervise and direct staff
- Analyze, develop, write, and recommend policies and procedures
- Knowledge of laws, policies, and procedures associated with civil, family law, probate, appeals, criminal, and juvenile cases
- Knowledge of management and supervisory principles and practices

DATA EXPOSURE: Division-wide access across all case types. Supervisory access to personnel records. Policy-level decisions affecting how staff handle protected data. Highest administrative authority of the three classifications.
```

---

## 3. User Message Template

Assembled at query time. Values in `[brackets]` are replaced with user input.

```
ROLE CONTEXT:
[Insert role_context[selected_role] here]

USER ASSESSMENT REQUEST:
Role selected: [role_display_name]
Data sensitivity level: [Low | Medium | High]
Workflow description: [user_workflow_text]

SENSITIVITY GUIDANCE:
- Low: Public-facing workflows, scheduling, general administrative tasks. No case-specific data.
- Medium: Internal workflows, non-sealed records, staff coordination.
- High: Sealed records, minors, active case PII, evidence, juror data, victim information.

Return a JSON object with exactly this structure. No other text:

{
  "can_help": [
    {
      "workflow_name": "string — specific workflow title, max 8 words",
      "why_safe": "string — why AI assistance is appropriate for this workflow given the role and sensitivity level",
      "guardrails": "string — specific precautions required before and during AI use"
    }
  ],
  "must_not_touch": [
    {
      "workflow_name": "string — specific workflow title, max 8 words",
      "rule": "string — the governance principle that restricts AI here. No statute citations.",
      "risk": "string — specific consequence if AI is used here without restriction",
      "instead": "string — the human alternative or existing approved process"
    }
  ]
}

Return both arrays in a single response. 3 to 5 items in each array. Items must be specific to the role and workflow described. Do not return generic advice that would apply to any job. If the sensitivity level is High, weight the must_not_touch array toward caution.
```

---

## 4. Temperature and Token Settings

**Single API call per assessment. Temperature `0.2`. `max_tokens: 6000`.**

| Output | Temperature | Max Tokens | Reasoning |
|---|---|---|---|
| Both arrays in one response | `0.2` | `6000` | Lower temperature favors consistency. Restrictions need to land the same way every time. Opportunities are slightly less creative as a result, which is an acceptable trade in a court governance context. The 6000 ceiling gives multi-item responses room to breathe — at 4096 some `why_safe` and `rule` fields were getting cramped during Block 2 testing. |

**Implementation note for Kiro:** One API call per assessment. The system prompt and user message template (Sections 1 and 3) request both arrays in the same response. Parse the JSON response, validate both arrays exist and meet the structural contract, return to client.

**v2 enhancement (do not build now):** Two-call differential temperature (0.7 for `can_help`, 0.1 for `must_not_touch`) is the architecturally cleaner pattern for this product. It is documented as a v2 enhancement because the build scope for v1 prioritizes shipping a working PDF and a deployed live URL by May 14. Single-call at 0.2 captures most of the consistency benefit. The two-call version is a story for a future build update, not a v1 requirement.

```typescript
// STUB V2: Two-call differential temperature
// Implementation notes: split assessment into two Bedrock calls with the same system prompt
// and user message but request only one array per call. Call 1 at 0.7 returns can_help only.
// Call 2 at 0.1 returns must_not_touch only. Merge results before returning to client.
// Do not build until v1 is shipped and credit budget allows.
```

---

## 5. Expected Response — Example

Input: JA I/II, High sensitivity, workflow: "I process incoming family law filings and check them for completeness before they go to the judicial officer. I also help self-represented litigants understand what forms they need."

```json
{
  "can_help": [
    {
      "workflow_name": "Drafting procedural checklist summaries",
      "why_safe": "Restates procedural rules that the court already publishes for the public. No party data required to generate a checklist.",
      "guardrails": "Use only redacted or hypothetical examples as input. A supervising clerk reviews output before it reaches a judicial officer. Never input actual case numbers or party names."
    },
    {
      "workflow_name": "Summarizing self-help form instructions",
      "why_safe": "Content is public-facing educational material covered under Judicial Council approved self-help guidance. No case-specific data involved.",
      "guardrails": "Route any case-specific questions back to a Family Law Facilitator. AI output is a starting point for plain-language explanation, not legal advice."
    },
    {
      "workflow_name": "Drafting internal FAQ for common filing questions",
      "why_safe": "FAQ content is based on published court rules and procedures, not individual case data. Appropriate for AI-assisted drafting with human review.",
      "guardrails": "All FAQ content reviewed and approved by supervising clerk before distribution. Do not include case-specific examples."
    }
  ],
  "must_not_touch": [
    {
      "workflow_name": "Reviewing confidential family law filings",
      "rule": "Family law proceedings involving minors and domestic matters carry strict confidentiality requirements under California court policy. AI tools may not process case-specific content from these filings.",
      "risk": "Inputting filing content into a third-party AI model constitutes unauthorized disclosure of protected case information, regardless of the model's privacy policy.",
      "instead": "Continue current manual review process. Use the court's approved internal checklist template for completeness review."
    },
    {
      "workflow_name": "Assessing litigant circumstances for referrals",
      "rule": "Determinations affecting a litigant's legal situation require human judgment and carry accountability that cannot be delegated to an AI system.",
      "risk": "AI-generated referral guidance could misdirect a self-represented litigant with no recourse. The harm in a family law context is immediate and difficult to reverse.",
      "instead": "Route all referral assessments to the Family Law Facilitator. Use only approved referral criteria from court administration."
    },
    {
      "workflow_name": "Handling sealed petition documents",
      "rule": "Sealed documents may not be processed through any system outside court-controlled infrastructure under any circumstance.",
      "risk": "Processing sealed content through a third-party AI model is a reportable confidentiality breach, not a procedural lapse.",
      "instead": "Route sealed documents directly to the supervising clerk. Use only the internal review process approved by court IT."
    }
  ]
}
```

---

## 6. Error Handling

| Scenario | Handling |
|---|---|
| API call fails | Return meaningful error state to UI. Do not show blank screen. User-facing copy: "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor." |
| Response is not valid JSON | Catch parse error, log server-side, return error state to UI |
| Response missing required fields | Validate structure before rendering. If `can_help` or `must_not_touch` arrays are missing or empty, return error state |
| Workflow description under 120 characters | Blocked client-side and server-side before API call is made |
| Role is a disabled/stub classification | Blocked client-side before API call is made |

---

## 7. Security Checklist

- [ ] API key / AWS credentials stored in server-side `process.env` only — never exposed to client
- [ ] User input sanitized server-side before prompt assembly
- [ ] `textContent` not `innerHTML` used for all output rendering
- [ ] No `eval()` anywhere in the codebase
- [ ] try/catch on every fetch and on the Bedrock call
- [ ] Response JSON parsed safely with try/catch
- [ ] No user data stored server-side after response is returned

---

*Prompt Spec v1.2 — Built against PRD v1.3. Single Bedrock call at 0.2, max_tokens 6000. Two-call differential temperature documented as v2 enhancement. v1.2 polish: plain-language guardrails for court audience, verification step required for procedural research items. Do not modify court_context or role_context chunks without reviewing PRD Section 8 first.*