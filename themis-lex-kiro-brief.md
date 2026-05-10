# Themis Lex — Kiro Build Brief
**Version:** 1.1
**Status:** Ready for build
**Builder:** Judicial Services Manager, Santa Barbara Superior Court
**Build starts:** April 26, 2026
**Submission deadline:** May 14, 2026

---

## Who You Are Working With

I am a self-taught builder. I direct, validate, and approve. You generate. We are not pair programming as equals -- I am the creative director and you are the implementation agent. Every significant decision comes back to me before you act on it.

---

## Read These First. In This Order.

Before writing a single line of code, read all five documents completely:

1. **Kiro Brief v1.1** (this document) -- how we work together, what is non-negotiable
2. **Fast Lane Addendum v1.0** -- speed tradeoffs, batched implementation permissions, what stays gated
3. **PRD v1.3** -- what we are building, why, and the full feature scope
4. **Prompt Spec v1.2** -- the AI layer, prompt assembly, expected response structure
5. **Architecture v1.1** -- file structure, API routes, data flow, component map

If anything in these documents conflicts with each other, flag it to me before proceeding. Do not resolve conflicts on your own. Where the Fast Lane Addendum modifies the Kiro Brief workflow rules, the Addendum is the authoritative document for v1 build scope.

---

## How We Work Together

**Propose before implementing.**
Before writing code for any block, tell me what you plan to build and how. Wait for my approval. Do not surprise me with implementations I did not authorize.

**One block at a time.**
Follow the build order in PRD Section 9 and Architecture Section 10 exactly. Do not start Block 2 until Block 1 passes QA. Do not start Block 3 until Block 2 passes QA. The QA checkpoints are not optional.

**QA checkpoint format:**
After each block, present me with:
- What you built
- The QA question from the PRD
- Your assessment: Pass or Fail
- If Fail: what needs to change before we move on

**Flag before refactoring.**
If you see something in an earlier block that you think should be changed while working on a later block, flag it to me. Do not refactor silently. Do not touch code outside the current block without explicit permission.

---

## What You Must Never Do

- Build any feature not explicitly listed as MUST in PRD Section 6
- Build any STUB feature -- add the comment, nothing else
- Use `innerHTML` anywhere in the codebase
- Use `eval()` anywhere in the codebase
- Expose any API key or credential to the client
- Store user data server-side after the response is returned
- Skip input validation on the server side because it exists on the client
- Return a blank screen or raw error message to the user under any circumstance
- Refactor code outside the current block without asking first
- Make architecture decisions not documented in Architecture v1.1 without flagging first

---

## What STUB Means

If a feature is labeled STUB in the PRD, you add a comment in the exact location where the feature would live. Nothing else. The comment format is:

```typescript
// STUB V2: [Feature name]
// Implementation notes: [what it would do, what it depends on]
// Do not build until [specific condition]
```

Do not build half the feature and stub the rest. Do not build a placeholder UI. A stub is a comment, not code.

---

## Security Is Non-Negotiable

Apply every item in Architecture Section 9 to every file, every endpoint, every commit. These are not suggestions. If you are unsure whether something violates a security rule, ask before proceeding.

The short version:
- `textContent` not `innerHTML`
- No `eval()`
- API keys in server-side `process.env` only
- Validate inputs client-side AND server-side -- both, always
- try/catch on every fetch, every Bedrock call, every JSON parse
- Meaningful error states everywhere -- never blank, never raw

---

## File and Folder Rules

One file, one responsibility. If you find yourself putting two distinct responsibilities in one file, stop and flag it.

Follow the folder structure in Architecture Section 2 exactly. Do not create files or folders not listed there without asking first.

---

## The AI Layer

The prompt assembly logic is fully specified in Prompt Spec v1.2. Do not improvise the system prompt. Do not change the role context chunks. Do not adjust the temperature setting without asking.

**One Bedrock call per assessment, at temperature `0.2`.** Returns both `can_help` and `must_not_touch` arrays in one structured response. Two-call differential temperature is documented as a v2 enhancement and must not be built in v1. See Prompt Spec Section 4 for the full rationale.

Model: Claude Sonnet via AWS Bedrock. Verify the current Bedrock model ID string in the AWS console before Block 2.

---

## The Three Active Roles

Only these three role values are active in Phase 1:
- `ja1_2` -- Judicial Assistant I / II
- `ja3_courtroom` -- Judicial Assistant III Courtroom
- `jss` -- Judicial Services Supervisor / Sr.

All other roles in the dropdown are disabled. They must be rejected server-side even if a client bypasses the UI. Return a 400 with a user-facing message if a disabled role is submitted.

---

## Tone Check

This tool is built for California court staff. The outputs they receive need to be clear, plain, and trustworthy. Never let the model return jargon, hedging language, or corporate filler. The prompt spec enforces this -- but if you see output during testing that does not read like something a court employee would trust, flag it.

---

## When In Doubt

Ask. Do not guess. Do not make a call that feels like it should be mine. A question costs 30 seconds. An unauthorized decision costs a block.

---


---

## Kiro Hooks — Automated Safety Rails

Hooks enforce the code safety rules automatically. They run whether you remember the rules or not. Configure these in your Kiro project settings before Block 1.

**What hooks can enforce:**
- Code safety rules (innerHTML, eval, exposed keys)
- File and folder boundaries
- Dependency hygiene
- Environment variable protection

**What hooks cannot enforce:**
- Propose before implement -- that is a workflow discipline, covered in this brief
- Block-by-block gating -- that is a QA checkpoint discipline, covered in this brief

Both of those depend on Kiro following the brief. Hooks are the floor, not the ceiling.

---

### Hook 1 — Block innerHTML

**Trigger:** Pre-file write, any `.ts` `.tsx` `.js` `.jsx` file
**Rule:** Flag and halt if `innerHTML` appears anywhere in the file
**Message:** "innerHTML is prohibited in Themis Lex. Use textContent. See Kiro Brief security rules."

```json
{
  "hook": "pre-file-write",
  "pattern": "innerHTML",
  "action": "block",
  "message": "innerHTML is prohibited. Use textContent. See Kiro Brief security rules."
}
```

---

### Hook 2 — Block eval()

**Trigger:** Pre-file write, any `.ts` `.tsx` `.js` `.jsx` file
**Rule:** Flag and halt if `eval(` appears anywhere in the file
**Message:** "eval() is prohibited in Themis Lex. See Kiro Brief security rules."

```json
{
  "hook": "pre-file-write",
  "pattern": "eval(",
  "action": "block",
  "message": "eval() is prohibited. See Kiro Brief security rules."
}
```

---

### Hook 3 — Block client-side environment variable exposure

**Trigger:** Pre-file write, any file in `/app` or `/components`
**Rule:** Flag and halt if any environment variable without `NEXT_PUBLIC_` prefix appears in a client-side file
**Message:** "API keys and credentials must live in server-side API routes only. See Kiro Brief security rules."

```json
{
  "hook": "pre-file-write",
  "scope": ["app/", "components/"],
  "pattern": "process.env.AWS|process.env.BEDROCK",
  "action": "block",
  "message": "Credentials detected in client-side file. Move to /pages/api/ only. See Kiro Brief security rules."
}
```

---

### Hook 4 — Protect .env.local from commits

**Trigger:** Pre-commit
**Rule:** Block commit if `.env.local` is staged
**Message:** ".env.local must never be committed. Check your .gitignore."

```json
{
  "hook": "pre-commit",
  "pattern": ".env.local",
  "action": "block",
  "message": ".env.local must never be committed. Check your .gitignore before proceeding."
}
```

---

### Hook 5 — Flag files outside documented structure

**Trigger:** Pre-file write
**Rule:** Flag (warn, do not block) if a new file is created outside the folders listed in Architecture Section 2
**Message:** "This file is outside the documented folder structure. Flag to builder before proceeding."

Allowed roots:
- `app/`
- `components/`
- `pages/api/`
- `lib/`
- `data/`
- `public/`

```json
{
  "hook": "pre-file-write",
  "allowed_paths": ["app/", "components/", "pages/api/", "lib/", "data/", "public/"],
  "action": "warn",
  "message": "File is outside documented folder structure. Flag to builder before proceeding."
}
```

---

### Hook 6 — Flag new dependencies

**Trigger:** Pre-command, any `npm install` or `yarn add`
**Rule:** Warn before any new package is installed
**Message:** "New dependency detected. Confirm this package is in the architecture doc before installing."

```json
{
  "hook": "pre-command",
  "pattern": "npm install|yarn add",
  "action": "warn",
  "message": "New dependency detected. Confirm this package is documented in Architecture v1.1 before installing."
}
```

---

### Hook Summary

| Hook | Trigger | Action | Covers |
|---|---|---|---|
| Block innerHTML | Pre-file write | Block | Security |
| Block eval() | Pre-file write | Block | Security |
| Block credential exposure | Pre-file write (client files) | Block | Security |
| Protect .env.local | Pre-commit | Block | Security |
| Flag undocumented files | Pre-file write | Warn | Architecture |
| Flag new dependencies | Pre-command | Warn | Architecture |

Blocks are non-negotiable. Warns require builder approval before proceeding.

*Kiro Brief v1.1 -- Read this first, then the Fast Lane Addendum. Come back to it whenever you are unsure about scope, process, or guardrails.*